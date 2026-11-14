# Table felt shows the colour being played. Needs the stand-in running.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
FELT="getComputedStyle(document.getElementById('ring')).getPropertyValue('--felt1').trim()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); s=await ctx.new_page()
        s.on('pageerror', lambda e: errs.append(str(e)))
        await s.goto(BASE); await s.fill('#nameInput','Vinay'); await s.click('#nameGo'); await s.click('#soloBtn')
        await s.select_option('#soloCount','3'); await s.select_option('#soloTime','0'); await s.click('#soloStart')
        await s.wait_for_selector('#game:not(.hidden)'); await s.wait_for_timeout(800)
        seen={}
        for _ in range(240):
            col=await s.get_attribute('#ring','data-color'); top=await s.get_attribute('#discard .card','class') or ''
            dot=await s.evaluate("document.getElementById('colorDot').style.background")
            names={'r':'red','y':'yellow','g':'green','b':'blue'}
            assert col in names and names[col] in dot, (col, dot)      # table always matches the colour dot
            if col not in seen:
                await s.wait_for_timeout(600); seen[col]=await s.evaluate(FELT)
                if await s.get_attribute('#ring','data-color')==col: await s.screenshot(path=f'tc_{col}.png')
            if len(seen)==4 or await s.is_visible('#endOverlay'): break
            # keep the round going: play a card if it's my turn, otherwise wait for the computer players
            if 'mine' in (await s.get_attribute('#status','class') or ''):
                pl=s.locator('#hand .card.playable')
                if await pl.count():
                    await pl.first.click(force=True); await s.wait_for_timeout(250)
                    if await s.is_visible('#colorPicker'): await s.locator('#colorPicker button').nth(len(seen)%4).click(force=True)
                elif await s.is_visible('#passBtn'): await s.click('#passBtn', force=True)
                else: await s.click('#drawBtn', force=True)
            await s.wait_for_timeout(350)
        print('colours seen and their felt:', seen)
        assert len(set(seen.values()))==len(seen) and len(seen)>=2
        fits=await s.evaluate("document.documentElement.scrollHeight<=innerHeight"); print('no scrolling:', fits); assert fits
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
