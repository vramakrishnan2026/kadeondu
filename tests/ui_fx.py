import asyncio, random
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2)).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); laughreq=[]; pg.on('request', lambda r: laughreq.append(r.url) if 'evil-laugh' in r.url else None)
        await pg.goto('http://localhost:8788/'); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#soloBtn')
        await pg.select_option('#soloCount','5'); await pg.check('#soloWd4Fx'); await pg.click('#soloStart'); await pg.wait_for_selector('#game:not(.hidden)')
        seen=False
        for i in range(900):
            if await pg.locator('.fx-laugh').count():
                seen=True; break
            if await pg.is_visible('#endOverlay'): await pg.click('#nextRoundBtn')
            if 'mine' in (await pg.get_attribute('#status','class') or ''):
                wd=pg.locator('#hand .card.playable[aria-label="Wild +4"]')
                c=wd.first if await wd.count() else (pg.locator('#hand .card.playable').first if await pg.locator('#hand .card.playable').count() else None)
                if c:
                    await c.click(force=True)
                    if await pg.is_visible('#colorPicker'): await pg.click('#colorPicker [data-color=g]')
                elif await pg.is_visible('#passBtn'): await pg.click('#passBtn', force=True)
                elif await pg.is_visible('#drawBtn'): await pg.click('#drawBtn', force=True)
            await pg.wait_for_timeout(100)
        print('effect seen:', seen)
        await pg.wait_for_timeout(1300); await pg.screenshot(path='fx1.png')
        r=await pg.evaluate("(()=>{const b=document.querySelector('.fx-who').getBoundingClientRect();return [b.left+b.width/2, b.top+b.height/2, innerWidth/2, innerHeight/2]})()")
        print('centre check (box centre vs screen centre):', [round(x) for x in r])
        await pg.wait_for_timeout(900); await pg.screenshot(path='fx2.png')
        await pg.wait_for_timeout(2300); print('gone after 3s:', await pg.locator('.fx-laugh').count()==0)
        print('laugh sound fetched:', len(laughreq)>0); print('errors', errs); await b.close()
asyncio.run(main())
