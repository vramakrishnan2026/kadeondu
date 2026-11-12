import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, permissions=['clipboard-read','clipboard-write'])
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8788/'); await pg.click('#shareTopBtn')
        print('home share url:', await pg.text_content('#shareUrl'), '| wa:', (await pg.get_attribute('#shareWa','href'))[:60])
        await pg.click('#closeShare')
        await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#createBtn'); await pg.wait_for_selector('#lobby:not(.hidden)')
        await pg.click('#shareTopBtn'); await pg.wait_for_timeout(200)
        print('room share url:', await pg.text_content('#shareUrl'), '| native button shown:', await pg.is_visible('#shareNative'))
        await pg.screenshot(path='share_modal.png')
        await pg.click('#shareCopy'); await pg.wait_for_timeout(200)
        print('clipboard:', await pg.evaluate('navigator.clipboard.readText()'), '| toast:', await pg.text_content('#toast'))
        print('errors', errs); await b.close()
asyncio.run(main())
