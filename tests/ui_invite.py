# Invites ring until answered: sound + buzz every 3 s for up to 30 s, then the inviter is told there was no answer.
# Needs the stand-in running.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'; errs=[]
async def person(b, name):
    pg=await (await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2)).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.clock.install(); await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(500); return pg
async def invite(a, name):
    if not await a.is_visible('#peopleModal'): await a.click('#inviteLobbyBtn')
    await a.wait_for_timeout(400); await a.locator('#peopleList > *', has_text=name).locator('button').click(); await a.wait_for_timeout(500)
rings=lambda pg: pg.evaluate("+document.getElementById('inviteModal').dataset.rings")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        a=await (await b.new_context(viewport={'width':390,'height':780})).new_page(); a.on('pageerror', lambda e: errs.append(str(e)))
        await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        pr=await person(b,'Priya'); ki=await person(b,'Kiran'); me=await person(b,'Meera')
        # 1. no answer
        await pr.evaluate("() => { window.__tones=0; const C=window.AudioContext; const o=C.prototype.createOscillator; C.prototype.createOscillator=function(){window.__tones++; return o.call(this)}; }")
        await invite(a,'Priya')
        print('Priya: pop-up', await pr.is_visible('#inviteModal'), '|', await pr.text_content('#inviteTitle'), '| rings so far', await rings(pr), '| notes played', await pr.evaluate('window.__tones'))
        assert await pr.is_visible('#inviteModal') and await rings(pr)==1 and await pr.evaluate('window.__tones')==3
        await pr.screenshot(path='invite_ringing.png')
        await pr.clock.run_for(7000); print('after 7 s: rings', await rings(pr)); assert await rings(pr)==3
        await pr.clock.run_for(24000); await pr.wait_for_timeout(400)
        print('after 31 s: pop-up closed', not await pr.is_visible('#inviteModal'), '| rings', await rings(pr), '| Priya sees:', (await pr.text_content('#toast')).strip(), '| Arun sees:', (await a.text_content('#toast')).strip())
        assert not await pr.is_visible('#inviteModal') and await rings(pr)==10 and "didn't answer" in await a.text_content('#toast')
        await pr.clock.run_for(10000); print('no more rings after it gives up:', await rings(pr)==10); assert await rings(pr)==10
        # 2. Not now stops the ringing at once
        await invite(a,'Meera'); await me.clock.run_for(4000); r=await rings(me); await me.click('#declineInvite'); await me.clock.run_for(10000); await a.wait_for_timeout(300)
        print('Meera taps Not now after', r, 'rings; rings afterwards', await rings(me), '| Arun sees:', (await a.text_content('#toast')).strip()); assert await rings(me)==r and "can't play" in await a.text_content('#toast')
        # 3. Join stops the ringing and joins the room
        await invite(a,'Kiran'); await ki.clock.run_for(4000); r=await rings(ki); await ki.click('#acceptInvite'); await ki.wait_for_selector('#lobby:not(.hidden)'); await ki.clock.run_for(40000); await a.wait_for_timeout(300)
        print('Kiran taps Join after', r, 'rings; rings afterwards', await rings(ki), '| in the room:', await ki.is_visible('#lobby'), "| Arun is not told 'no answer':", "didn't answer" not in await a.text_content('#toast'))
        assert await rings(ki)==r and await ki.is_visible('#lobby') and "didn't answer" not in await a.text_content('#toast')
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
