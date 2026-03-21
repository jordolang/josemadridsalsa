const { PrismaClient } = require('@prisma/client');
const { runGoogleSearchScraper } = require('../lib/scraper/google-search');
const { runWebsiteParser } = require('../lib/scraper/website-parser');

async function test() {
  const prisma = new PrismaClient();
  console.log("Creating test campaign...");
  const campaign = await prisma.leadCampaign.create({
    data: {
      name: "Dublin OH High Schools Test",
      city: "Dublin",
      state: "OH",
      district: "",
      schoolType: "high school",
      status: "DRAFT"
    }
  });

  console.log("Creating test school lead...");
  await prisma.lead.create({
    data: {
      campaignId: campaign.id,
      schoolName: "Dublin Jerome High School",
      schoolUrl: "https://jeromeathletics.net/",
      city: "Dublin",
      state: "OH",
      status: "SCRAPED"
    }
  });

  const leadsAfterSearch = await prisma.lead.findMany({ where: { campaignId: campaign.id } });
  console.log(`Found ${leadsAfterSearch.length} schools.`);
  if (leadsAfterSearch.length > 0) {
    console.log("Sample school:", leadsAfterSearch[0].schoolName, leadsAfterSearch[0].schoolUrl);
  }

  // To save time and keep it simple, limit to parsing just 1 lead if any exist
  if (leadsAfterSearch.length > 0) {
    console.log("Running Website Parser on first school...");
    // We can't easily restrict runWebsiteParser to 1 school without modifying it, 
    // but the test is just to see if it works without crashing. Let's just run it!
    await runWebsiteParser(campaign.id);
    
    const leadsAfterParse = await prisma.lead.findMany({ where: { campaignId: campaign.id, status: 'CONTACT_FOUND' } });
    console.log(`Found ${leadsAfterParse.length} contacts.`);
    if (leadsAfterParse.length > 0) {
      console.log("Sample contact:", leadsAfterParse[0].contactName, leadsAfterParse[0].title, leadsAfterParse[0].email, leadsAfterParse[0].sport);
    }
  }

  console.log("Cleaning up...");
  await prisma.leadCampaign.delete({ where: { id: campaign.id } });
  console.log("Done.");
  process.exit(0);
}

test().catch(console.error);
