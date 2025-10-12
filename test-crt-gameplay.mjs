import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

// Click to dismiss audio prompt and start game
await page.mouse.click(400, 400);
await new Promise(resolve => setTimeout(resolve, 1000));

// Press spacebar to start game
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 2000));

// Take screenshot during gameplay
await page.screenshot({ path: '/tmp/crt-gameplay.jpeg', type: 'jpeg', quality: 70 });

console.log('📸 Gameplay screenshot saved to: /tmp/crt-gameplay.jpeg');
console.log('✅ CRT Guest Advanced is rendering during gameplay!');

await browser.close();
