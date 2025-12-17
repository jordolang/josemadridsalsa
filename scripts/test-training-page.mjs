import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');

    console.log('Filling in credentials...');
    await page.fill('input[type="email"]', 'admin@josemadrid.net');
    await page.fill('input[type="password"]', 'admin123456');
    
    console.log('Submitting login form...');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    console.log('Navigating to AI Training page...');
    await page.goto('http://localhost:3000/admin/training-data');
    await page.waitForLoadState('networkidle');

    // Check for errors
    const hasError = await page.locator('text=/error|Error/i').count() > 0;
    const pageTitle = await page.locator('h1').first().textContent();
    
    console.log('Page title:', pageTitle);
    console.log('Has error:', hasError);

    if (hasError) {
      console.log('❌ Page has errors!');
      const errorText = await page.locator('text=/error/i').first().textContent();
      console.log('Error text:', errorText);
      process.exit(1);
    } else if (pageTitle && pageTitle.includes('AI Training')) {
      console.log('✅ AI Training page loaded successfully!');
      
      // Check for key elements
      const hasUploadForm = await page.locator('text=/Upload documents/i').count() > 0;
      const hasScrapeForm = await page.locator('text=/Scrape a URL/i').count() > 0;
      const hasStats = await page.locator('text=/Total sources/i').count() > 0;
      
      console.log('Has upload form:', hasUploadForm);
      console.log('Has scrape form:', hasScrapeForm);
      console.log('Has stats:', hasStats);
      
      if (hasUploadForm && hasScrapeForm && hasStats) {
        console.log('✅ All components rendered correctly!');
      }
    } else {
      console.log('❌ Expected page title not found');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
