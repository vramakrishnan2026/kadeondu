import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':780}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8788/'); await pg.wait_for_timeout(1500)
        cdp=await ctx.new_cdp_session(pg)
        r=await cdp.send('Page.getInstallabilityErrors'); print('installability errors:', r.get('installabilityErrors'))
        print('sw registered:', await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
        m=await cdp.send('Page.getAppManifest'); print('manifest errors:', m.get('errors'))
        # iPhone
        ictx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')
        ip=await ictx.new_page(); await ip.goto('http://localhost:8788/'); await ip.fill('#nameInput','Asha'); await ip.click('#nameGo'); await ip.wait_for_timeout(400)  # the Install button is on the menu, after the name step
        print('iphone install button:', await ip.is_visible('#installBtn')); await ip.click('#installBtn'); await ip.wait_for_timeout(200)
        await ip.screenshot(path='ios_install.png'); print('errors', errs); await b.close()
asyncio.run(main())
