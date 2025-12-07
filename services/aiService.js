const OpenAI = require('openai');

let openai = null;

// Initialize OpenAI client only if API key is available
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI client initialized');
  } else {
    console.log('⚠️ OpenAI API key not configured - using fallback parsers');
  }
} catch (error) {
  console.log('⚠️ OpenAI initialization failed - using fallback parsers');
}

/**
 * Fallback parser when OpenAI is unavailable
 * Uses regex to extract basic information from natural language
 */
function fallbackParseRFP(userInput) {
  const input = userInput.toLowerCase();
  
  // Extract budget
  const budgetMatch = userInput.match(/\$[\d,]+|\d+[\d,]*\s*(dollars|usd)/i);
  let budget = null;
  if (budgetMatch) {
    budget = parseInt(budgetMatch[0].replace(/[$,\s]|dollars|usd/gi, ''));
  }

  // Extract delivery days
  const deliveryMatch = input.match(/(\d+)\s*(days?|weeks?)/i);
  let deliveryDays = null;
  if (deliveryMatch) {
    deliveryDays = parseInt(deliveryMatch[1]);
    if (deliveryMatch[2].includes('week')) {
      deliveryDays *= 7;
    }
  }

  // Extract items with quantities
  const items = [];
  const itemPatterns = [
    /(\d+)\s*(laptops?|computers?|pcs?|machines?)/gi,
    /(\d+)\s*(monitors?|displays?|screens?)/gi,
    /(\d+)\s*(keyboards?|mice|mouse)/gi,
    /(\d+)\s*(chairs?|desks?|tables?)/gi,
    /(\d+)\s*(phones?|mobiles?|handsets?)/gi,
    /(\d+)\s*(printers?|scanners?)/gi,
    /(\d+)\s*(servers?|routers?|switches?)/gi,
  ];

  itemPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(userInput)) !== null) {
      items.push({
        name: match[2].replace(/s$/, '').charAt(0).toUpperCase() + match[2].replace(/s$/, '').slice(1),
        quantity: parseInt(match[1]),
        specifications: ''
      });
    }
  });

  // Extract RAM specifications
  const ramMatch = userInput.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch && items.length > 0) {
    items[0].specifications = `${ramMatch[1]}GB RAM`;
  }

  // Extract screen size
  const screenMatch = userInput.match(/(\d+)[- ]?(inch|")/i);
  if (screenMatch) {
    const monitorItem = items.find(i => i.name.toLowerCase().includes('monitor'));
    if (monitorItem) {
      monitorItem.specifications = `${screenMatch[1]} inch`;
    }
  }

  // Extract payment terms
  let paymentTerms = null;
  if (input.includes('net 30')) paymentTerms = 'Net 30';
  else if (input.includes('net 60')) paymentTerms = 'Net 60';
  else if (input.includes('net 15')) paymentTerms = 'Net 15';
  else if (input.includes('immediate') || input.includes('advance')) paymentTerms = 'Advance Payment';

  // Extract warranty
  let warranty = null;
  const warrantyMatch = input.match(/(\d+)\s*(year|month)s?\s*warranty/i);
  if (warrantyMatch) {
    warranty = `${warrantyMatch[1]} ${warrantyMatch[2]}${parseInt(warrantyMatch[1]) > 1 ? 's' : ''} warranty`;
  }

  // Generate title
  const itemNames = items.map(i => i.name).join(' and ');
  const title = items.length > 0 
    ? `${itemNames} Procurement` 
    : 'Procurement Request';

  return {
    title: title,
    description: userInput.substring(0, 200),
    budget: budget,
    currency: 'USD',
    deliveryDays: deliveryDays,
    items: items.length > 0 ? items : [{ name: 'Items as specified', quantity: 1, specifications: userInput.substring(0, 100) }],
    requirements: {
      paymentTerms: paymentTerms,
      warranty: warranty,
      deliveryLocation: null,
      additionalTerms: []
    }
  };
}

/**
 * Parse natural language procurement request into structured RFP data
 */
async function parseRFPFromNaturalLanguage(userInput) {
  // If OpenAI is not available, use fallback immediately
  if (!openai) {
    console.log('OpenAI not available, using fallback parser...');
    const fallbackData = fallbackParseRFP(userInput);
    return {
      success: true,
      data: fallbackData,
      usedFallback: true
    };
  }

  const systemPrompt = `You are an RFP (Request for Proposal) extraction assistant. Your job is to extract structured information from natural language procurement requests.

Extract the following information and return as JSON:
{
  "title": "A concise title for the RFP",
  "description": "A brief description of what is being procured",
  "budget": <number or null if not specified>,
  "currency": "USD" or appropriate currency code,
  "deliveryDays": <number of days for delivery or null>,
  "items": [
    {
      "name": "item name",
      "quantity": <number>,
      "specifications": "any specifications mentioned"
    }
  ],
  "requirements": {
    "paymentTerms": "payment terms if mentioned",
    "warranty": "warranty requirements if mentioned",
    "deliveryLocation": "delivery location if mentioned",
    "additionalTerms": ["any other requirements or terms"]
  }
}

Be thorough but only include information that is explicitly stated or can be reasonably inferred from the input.
Return ONLY valid JSON, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    return {
      success: true,
      data: parsedData
    };
  } catch (error) {
    console.error('Error parsing RFP with OpenAI:', error.message);
    
    // Fallback to basic parsing when OpenAI fails
    console.log('Using fallback parser...');
    try {
      const fallbackData = fallbackParseRFP(userInput);
      return {
        success: true,
        data: fallbackData,
        usedFallback: true
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Parse vendor proposal email into structured data
 */
async function parseVendorProposal(emailBody, emailSubject, rfpContext) {
  // If OpenAI is not available, use fallback immediately
  if (!openai) {
    console.log('OpenAI not available, using fallback proposal parser...');
    const fallbackData = fallbackParseProposal(emailBody);
    return {
      success: true,
      data: fallbackData,
      usedFallback: true
    };
  }

  const systemPrompt = `You are a proposal parsing assistant. Extract structured information from vendor proposal emails.

Context - This is a response to an RFP for: ${rfpContext}

Extract the following from the vendor's response and return as JSON:
{
  "totalPrice": <total quoted price as number>,
  "itemPricing": [
    {
      "itemName": "name of item",
      "quantity": <number>,
      "unitPrice": <unit price as number>,
      "totalPrice": <total for this item>,
      "notes": "any notes about this item"
    }
  ],
  "deliveryTimeline": "stated delivery timeline",
  "deliveryDays": <number of days if mentioned>,
  "paymentTerms": "payment terms offered",
  "warranty": "warranty terms offered",
  "validityPeriod": "how long this quote is valid",
  "conditions": ["any conditions or special terms"],
  "notes": "any additional notes or observations"
}

Extract information that is explicitly stated. Use null for fields that cannot be determined.
Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Subject: ${emailSubject}\n\nEmail Body:\n${emailBody}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    return {
      success: true,
      data: parsedData
    };
  } catch (error) {
    console.error('Error parsing proposal with OpenAI:', error.message);
    
    // Fallback parsing for proposals
    console.log('Using fallback proposal parser...');
    const fallbackData = fallbackParseProposal(emailBody);
    return {
      success: true,
      data: fallbackData,
      usedFallback: true
    };
  }
}

/**
 * Fallback proposal parser
 */
function fallbackParseProposal(emailBody) {
  const text = emailBody.toLowerCase();
  
  // Extract prices
  const priceMatches = emailBody.match(/\$[\d,]+\.?\d*/g) || [];
  const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
  const totalPrice = prices.length > 0 ? Math.max(...prices) : null;

  // Extract delivery
  let deliveryDays = null;
  const deliveryMatch = text.match(/(\d+)\s*(days?|weeks?|business days?)/i);
  if (deliveryMatch) {
    deliveryDays = parseInt(deliveryMatch[1]);
    if (deliveryMatch[2].includes('week')) deliveryDays *= 7;
  }

  // Extract payment terms
  let paymentTerms = null;
  if (text.includes('net 30')) paymentTerms = 'Net 30';
  else if (text.includes('net 60')) paymentTerms = 'Net 60';
  else if (text.includes('net 15')) paymentTerms = 'Net 15';

  // Extract warranty
  let warranty = null;
  const warrantyMatch = text.match(/(\d+)\s*(year|month)s?\s*warranty/i);
  if (warrantyMatch) {
    warranty = `${warrantyMatch[1]} ${warrantyMatch[2]}${parseInt(warrantyMatch[1]) > 1 ? 's' : ''} warranty`;
  }

  return {
    totalPrice: totalPrice,
    itemPricing: [],
    deliveryTimeline: deliveryDays ? `${deliveryDays} days` : null,
    deliveryDays: deliveryDays,
    paymentTerms: paymentTerms,
    warranty: warranty,
    validityPeriod: null,
    conditions: [],
    notes: 'Parsed using fallback parser'
  };
}

/**
 * Compare multiple proposals and generate recommendations
 */
async function compareProposals(rfp, proposals) {
  // If OpenAI is not available, use fallback immediately
  if (!openai) {
    console.log('OpenAI not available, using fallback comparison...');
    const fallbackAnalysis = fallbackCompareProposals(rfp, proposals);
    return {
      success: true,
      data: fallbackAnalysis,
      usedFallback: true
    };
  }

  const systemPrompt = `You are a procurement analysis assistant. Compare vendor proposals and provide recommendations.

Analyze the proposals based on:
1. Price competitiveness
2. Delivery timeline
3. Payment terms
4. Warranty and support
5. Overall value

Return your analysis as JSON:
{
  "comparison": {
    "summary": "Brief summary of comparison",
    "priceAnalysis": "Analysis of pricing across vendors",
    "deliveryAnalysis": "Analysis of delivery timelines",
    "termsAnalysis": "Analysis of terms and conditions"
  },
  "vendorScores": [
    {
      "vendorId": "vendor id",
      "vendorName": "vendor name",
      "priceScore": <0-100>,
      "deliveryScore": <0-100>,
      "termsScore": <0-100>,
      "overallScore": <0-100>,
      "pros": ["list of pros"],
      "cons": ["list of cons"],
      "summary": "brief summary for this vendor"
    }
  ],
  "recommendation": {
    "recommendedVendorId": "id of recommended vendor",
    "recommendedVendorName": "name of recommended vendor",
    "reasoning": "detailed reasoning for the recommendation",
    "risks": ["potential risks to consider"],
    "alternativeOption": "second best option if any"
  }
}`;

  const proposalDetails = proposals.map(p => ({
    vendorId: p.vendorId._id || p.vendorId,
    vendorName: p.vendorId.name || 'Unknown Vendor',
    parsedData: p.parsedData
  }));

  const userPrompt = `
RFP Details:
- Title: ${rfp.title}
- Budget: ${rfp.budget ? `$${rfp.budget}` : 'Not specified'}
- Required Delivery: ${rfp.deliveryDays ? `${rfp.deliveryDays} days` : 'Not specified'}
- Items: ${JSON.stringify(rfp.items)}
- Requirements: ${JSON.stringify(rfp.requirements)}

Proposals to Compare:
${JSON.stringify(proposalDetails, null, 2)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    return {
      success: true,
      data: analysis
    };
  } catch (error) {
    console.error('Error comparing proposals with OpenAI:', error.message);
    
    // Fallback comparison logic
    console.log('Using fallback comparison...');
    const fallbackAnalysis = fallbackCompareProposals(rfp, proposals);
    return {
      success: true,
      data: fallbackAnalysis,
      usedFallback: true
    };
  }
}

/**
 * Fallback comparison when OpenAI is unavailable
 */
function fallbackCompareProposals(rfp, proposals) {
  const vendorScores = proposals.map(p => {
    const price = p.parsedData?.totalPrice || 0;
    const delivery = p.parsedData?.deliveryDays || 999;
    const vendorName = p.vendorId?.name || 'Unknown Vendor';
    const vendorId = p.vendorId?._id || p.vendorId;

    // Simple scoring based on price and delivery
    const maxPrice = Math.max(...proposals.map(pr => pr.parsedData?.totalPrice || 0)) || 1;
    const minPrice = Math.min(...proposals.filter(pr => pr.parsedData?.totalPrice).map(pr => pr.parsedData.totalPrice)) || 0;
    
    const priceScore = price > 0 ? Math.round(100 - ((price - minPrice) / (maxPrice - minPrice || 1)) * 50) : 50;
    const deliveryScore = delivery < 999 ? Math.round(100 - (delivery / 60) * 50) : 50;
    const termsScore = p.parsedData?.warranty ? 80 : 60;
    const overallScore = Math.round((priceScore + deliveryScore + termsScore) / 3);

    return {
      vendorId: vendorId,
      vendorName: vendorName,
      priceScore: Math.max(0, Math.min(100, priceScore)),
      deliveryScore: Math.max(0, Math.min(100, deliveryScore)),
      termsScore: termsScore,
      overallScore: Math.max(0, Math.min(100, overallScore)),
      pros: [
        price > 0 ? `Quoted price: $${price.toLocaleString()}` : 'Price provided',
        delivery < 999 ? `Delivery in ${delivery} days` : 'Delivery timeline specified',
        p.parsedData?.warranty ? `Warranty: ${p.parsedData.warranty}` : null
      ].filter(Boolean),
      cons: [
        !p.parsedData?.totalPrice ? 'Price not clearly specified' : null,
        !p.parsedData?.warranty ? 'No warranty information' : null
      ].filter(Boolean),
      summary: `${vendorName} offers ${price > 0 ? '$' + price.toLocaleString() : 'competitive pricing'} with ${delivery < 999 ? delivery + ' days' : 'flexible'} delivery.`
    };
  });

  // Sort by overall score
  vendorScores.sort((a, b) => b.overallScore - a.overallScore);
  const recommended = vendorScores[0];

  return {
    comparison: {
      summary: `Compared ${proposals.length} vendor proposals based on price, delivery, and terms.`,
      priceAnalysis: 'Pricing compared based on total quoted amounts.',
      deliveryAnalysis: 'Delivery timelines compared based on stated delivery days.',
      termsAnalysis: 'Terms evaluated based on warranty and payment conditions.'
    },
    vendorScores: vendorScores,
    recommendation: {
      recommendedVendorId: recommended.vendorId,
      recommendedVendorName: recommended.vendorName,
      reasoning: `${recommended.vendorName} has the highest overall score of ${recommended.overallScore}/100 based on price competitiveness, delivery timeline, and terms.`,
      risks: ['This is a simplified analysis. Manual review recommended.'],
      alternativeOption: vendorScores.length > 1 ? `${vendorScores[1].vendorName} as second choice` : null
    }
  };
}

/**
 * Generate email content for sending RFP to vendors
 */
async function generateRFPEmail(rfp, vendorName) {
  // If OpenAI is not available, use fallback immediately
  if (!openai) {
    console.log('OpenAI not available, using fallback email generator...');
    const fallbackEmail = fallbackGenerateEmail(rfp, vendorName);
    return {
      success: true,
      data: fallbackEmail,
      usedFallback: true
    };
  }

  const systemPrompt = `You are a professional procurement assistant. Generate a formal RFP email to send to vendors.

The email should:
1. Be professional and clear
2. Include all RFP details
3. Specify response requirements
4. Include deadline information
5. Request itemized pricing

Return as JSON:
{
  "subject": "Email subject line",
  "body": "Full email body in plain text"
}`;

  const userPrompt = `
Generate an RFP email for:
- Vendor Name: ${vendorName}
- RFP Title: ${rfp.title}
- Description: ${rfp.description || 'Not provided'}
- Budget: ${rfp.budget ? `$${rfp.budget}` : 'Open to quotes'}
- Required Delivery: ${rfp.deliveryDays ? `Within ${rfp.deliveryDays} days` : 'To be discussed'}
- Items Required:
${rfp.items.map(item => `  - ${item.name}: Qty ${item.quantity}${item.specifications ? ` (${item.specifications})` : ''}`).join('\n')}
- Payment Terms: ${rfp.requirements?.paymentTerms || 'Standard terms'}
- Warranty Required: ${rfp.requirements?.warranty || 'Standard warranty'}
- Additional Requirements: ${rfp.requirements?.additionalTerms?.join(', ') || 'None specified'}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const emailContent = JSON.parse(response.choices[0].message.content);
    return {
      success: true,
      data: emailContent
    };
  } catch (error) {
    console.error('Error generating RFP email with OpenAI:', error.message);
    
    // Fallback email generation
    console.log('Using fallback email generator...');
    const fallbackEmail = fallbackGenerateEmail(rfp, vendorName);
    return {
      success: true,
      data: fallbackEmail,
      usedFallback: true
    };
  }
}

/**
 * Fallback email generator
 */
function fallbackGenerateEmail(rfp, vendorName) {
  const itemsList = rfp.items?.map(item => 
    `  • ${item.name}: Quantity ${item.quantity}${item.specifications ? ` (${item.specifications})` : ''}`
  ).join('\n') || '  • As per requirements';

  const subject = `Request for Proposal: ${rfp.title}`;
  
  const body = `Dear ${vendorName},

We are pleased to invite you to submit a proposal for the following procurement requirement:

PROJECT: ${rfp.title}
${rfp.description ? `\nDESCRIPTION: ${rfp.description}` : ''}

ITEMS REQUIRED:
${itemsList}

BUDGET: ${rfp.budget ? `$${rfp.budget.toLocaleString()}` : 'Open to competitive quotes'}
DELIVERY REQUIREMENT: ${rfp.deliveryDays ? `Within ${rfp.deliveryDays} days` : 'To be discussed'}
PAYMENT TERMS: ${rfp.requirements?.paymentTerms || 'Standard terms'}
WARRANTY: ${rfp.requirements?.warranty || 'Standard warranty expected'}

Please provide:
1. Itemized pricing for all items
2. Total cost including any applicable taxes
3. Delivery timeline
4. Warranty terms
5. Payment terms
6. Any conditions or special requirements

We look forward to receiving your proposal.

Best regards,
Procurement Team`;

  return { subject, body };
}

module.exports = {
  parseRFPFromNaturalLanguage,
  parseVendorProposal,
  compareProposals,
  generateRFPEmail
};

