import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
async def solo(b, n, path, w=390, h=780, flight=False):
    ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(BASE); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#soloBtn')
    await pg.select_option('#soloCount',str(n)); await pg.click('#soloStart'); await pg.wait_for_selector('#game:not(.hidden)')
    await pg.wait_for_timeout(400); await pg.screenshot(path=path)
    if flight:
        # wait for my turn, tap a playable card, screenshot mid-flight
        for _ in range(60):
            if 'mine' in (await pg.get_attribute('#status','class') or '') and await pg.locator('#hand .card.playable').count(): break
            await pg.wait_for_timeout(300)
        c=pg.locator('#hand .card.playable').first
        await c.click(force=True)
        if await pg.is_visible('#colorPicker'): await pg.click('#colorPicker [data-color=r]')
        await pg.wait_for_timeout(170); await pg.screenshot(path='ring_flight.png')
        print('flying nodes mid-air:', await pg.locator('.flying').count())
        await pg.wait_for_timeout(1500); print('flying nodes after:', await pg.locator('.flying').count())
        # a computer turn mid-flight
        for _ in range(40):
            await pg.wait_for_timeout(60)
            if await pg.locator('.flying').count(): await pg.screenshot(path='ring_flight2.png'); print('caught a computer card in flight'); break
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        await solo(b,3,'ring_4.png', flight=True)
        await solo(b,9,'ring_10.png')
        ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); pg=await ctx.new_page()
        await pg.goto(BASE); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#createBtn'); await pg.wait_for_selector('#lobby:not(.hidden)')
        for _ in range(19): await pg.click('#addBotBtn'); await pg.wait_for_timeout(40)
        await pg.click('#startBtn'); await pg.wait_for_selector('#game:not(.hidden)'); await pg.wait_for_timeout(400); await pg.screenshot(path='ring_20.png'); await ctx.close()
        await solo(b,5,'ring_desktop.png', w=1280, h=800)
        print('errors', errs); await b.close()
asyncio.run(main())
