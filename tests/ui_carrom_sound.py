# Carrom board sounds: off until switched on, the switch on the board screen, knocks counted during a shot,
# the choice remembered. (A test cannot listen: it checks that sounds are scheduled, not how they sound.)
# Needs the stand-in (bash prepare-mock.sh).
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); errs=[]
        a=await (await b.new_context(viewport={'width':360,'height':640})).new_page()
        a.on('pageerror', lambda e: errs.append(str(e))); a.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        async def solo():
            await a.goto(BASE)
            if await a.is_visible('#nameGo'): await a.fill('#nameInput','Arun'); await a.click('#nameGo')
            await a.wait_for_timeout(300); await a.click('.game-tab[data-game="carrom"]'); await a.click('#soloBtn'); await a.click('#csoloStart'); await a.wait_for_selector('#carrom:not(.hidden)'); await a.wait_for_timeout(600)
        async def shoot():
            for _ in range(60):
                if await a.is_enabled('#crSlide'): break
                await a.wait_for_timeout(400)
            await a.evaluate("KOCarrom._shoot(0.5, 0.02, -1, 0.9)"); await a.wait_for_timeout(500); await a.wait_for_selector('#carrom:not(.busy)', timeout=25000)
        snd=lambda: a.evaluate("KOCarrom._sound()")
        await solo()
        r=await a.evaluate("() => { const b=document.getElementById('crSound').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), inView: b.bottom <= innerHeight && b.right <= innerWidth, scroll: document.documentElement.scrollHeight - innerHeight } }")
        print('switch on the board screen:', await a.is_visible('#crSound'), r, '| off by default:', await snd(), '| label:', await a.get_attribute('#crSound','aria-label'))
        await shoot(); print('sound off: a break shot schedules nothing:', (await snd())['played']==0)
        await a.click('#crSound'); await a.wait_for_timeout(300); s1=await snd()
        print('switched on:', s1, '| shows', await a.text_content('#crSound'), '| pressed', await a.get_attribute('#crSound','aria-pressed'))
        await a.screenshot(path='carrom10_sound.png')
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); await solo()
        s2=await snd(); print('remembered after coming back:', s2['on'])
        await shoot(); s3=await snd(); print('sound on: knocks during a break shot:', s3['played'], '| audio running:', s3['state'])
        await a.click('#crSound'); await a.wait_for_timeout(200); n=(await snd())['played']; await shoot(); print('switched off again: nothing more scheduled:', (await snd())['played']==n, '| shows', await a.text_content('#crSound'))
        print('errors', errs); await b.close()
asyncio.run(main())
