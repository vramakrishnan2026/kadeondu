import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':390,'height':780})).new_page()
        await pg.goto('http://localhost:8788/'); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#soloBtn')
        print('default off in solo:', not await pg.is_checked('#soloWd4Fx'))
        await pg.select_option('#soloCount','5'); await pg.click('#soloStart'); await pg.wait_for_selector('#game:not(.hidden)')
        saw_wd4=False; saw_fx=False
        for i in range(2500):
            if await pg.locator('.fx-laugh').count(): saw_fx=True
            log=await pg.text_content('#logLine')
            if 'Wild +4' in (log or '') or 'picked up 4' in (log or ''): saw_wd4=True
            if saw_wd4: await pg.wait_for_timeout(900); saw_fx = saw_fx or await pg.locator('.fx-laugh').count()>0; break
            if await pg.is_visible('#endOverlay'): await pg.click('#nextRoundBtn')
            if 'mine' in (await pg.get_attribute('#status','class') or ''):
                c=pg.locator('#hand .card.playable')
                if await c.count():
                    await c.first.click(force=True)
                    if await pg.is_visible('#colorPicker'): await pg.click('#colorPicker [data-color=g]')
                elif await pg.is_visible('#passBtn'): await pg.click('#passBtn', force=True)
                elif await pg.is_visible('#drawBtn'): await pg.click('#drawBtn', force=True)
            await pg.wait_for_timeout(80)
        print('wild +4 played:', saw_wd4, '| animation shown:', saw_fx)
        # room: host toggle visible and default off
        pg2=await (await b.new_context(viewport={'width':390,'height':780})).new_page()
        await pg2.goto('http://localhost:8788/'); await pg2.fill('#nameInput','Arun'); await pg2.click('#nameGo'); await pg2.click('#createBtn'); await pg2.wait_for_selector('#lobby:not(.hidden)')
        print('room default off:', not await pg2.is_checked('#wd4FxInput'))
        await pg2.check('#wd4FxInput'); await pg2.wait_for_timeout(300); print('room after toggle on:', await pg2.is_checked('#wd4FxInput'))
        await b.close()
asyncio.run(main())
