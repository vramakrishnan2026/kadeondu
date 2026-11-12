import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
SIZES="""() => ['muteBtn','micBtn','callBtn','drawBtn','passBtn'].map(id=>{const e=document.getElementById(id); if(!e||e.offsetParent===null) return id+': hidden'; const r=e.getBoundingClientRect(); return `${id}: ${Math.round(r.width)}x${Math.round(r.height)} @x=${Math.round(r.left+r.width/2)}`})"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']); errs=[]
        async def page():
            x=await (await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, permissions=['microphone'])).new_page()
            x.on('pageerror', lambda e: errs.append(str(e))); x.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return x
        host=await page(); await host.goto(BASE); await host.fill('#nameInput','Arun'); await host.click('#nameGo'); await host.click('#createBtn'); await host.wait_for_selector('#lobby:not(.hidden)')
        code=(await host.text_content('#lobbyCode')).strip()
        watcher=await page(); await watcher.goto(BASE); await watcher.fill('#nameInput','Kiran'); await watcher.click('#nameGo'); await watcher.wait_for_timeout(600)
        print('public room listed:', await watcher.locator('#roomList li').count())
        await host.check('#privateInput'); await watcher.wait_for_timeout(600)
        print('private room listed:', await watcher.locator('#roomList li').count(), '| host chip:', await host.text_content('#roomChip'))
        print('Kiran sees Arun as:', (await watcher.locator('#peopleHome li', has_text='Arun').text_content()).strip())
        guest=await page(); await guest.goto(BASE+'?room='+code); await guest.fill('#nameInput','Priya'); await guest.click('#nameGo'); await guest.wait_for_selector('#lobby:not(.hidden)')
        print('join private room by link: OK | guest sees:', await guest.text_content('#guestSettings'))
        await host.select_option('#turnTimeInput','0'); await host.click('#startBtn'); await guest.wait_for_selector('#game:not(.hidden)'); await host.wait_for_timeout(500)
        me = host if 'mine' in (await host.get_attribute('#status','class') or '') else guest
        other = guest if me is host else host
        print('my turn  ->', await me.evaluate(SIZES)); await me.screenshot(path='ctl_right.png')
        hitArea=await me.evaluate("(()=>{const b=document.getElementById('drawBtn').getBoundingClientRect(); const cx=b.left+b.width/2; let top=0,bot=0; for(let y=b.top-12;y<b.bottom+12;y++){const e=document.elementFromPoint(cx,y); if(e&&e.closest('#drawBtn')){ if(!top) top=y; bot=y;} } return Math.round(bot-top+1)})()")
        print('draw tap area height:', hitArea)
        print('not my turn ->', await other.evaluate(SIZES))
        await me.evaluate("document.body.classList.add('lefty')"); await me.wait_for_timeout(200); print('left-handed ->', await me.evaluate(SIZES)); await me.screenshot(path='ctl_left.png')
        await me.click('#drawBtn', force=True); await me.wait_for_timeout(400)
        print('after draw ->', await me.evaluate(SIZES))
        print('errors', errs); await b.close()
asyncio.run(main())
