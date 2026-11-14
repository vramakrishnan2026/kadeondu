# Inactive player: after 5 timer-played turns in a row an ✕ appears on them for the other players;
# tapping it asks first, then removes them. Needs the stand-in running (uses its /__test/rig shortcut).
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'; errs=[]
def rig(q): urllib.request.urlopen(BASE+'__test/rig?'+q).read()
async def newpage(b):
    pg=await (await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2)).new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        a=await newpage(b); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip(); o={}
        for n in ('Priya','Kiran'):
            q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput',n); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)'); o[n]=q
        await a.select_option('#turnTimeInput','0'); await a.click('#startBtn'); await a.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(800)
        w=await newpage(b); await w.goto(BASE+'?room='+code); await w.fill('#nameInput','Meera'); await w.click('#nameGo'); await w.wait_for_selector('#game:not(.hidden)'); await w.wait_for_timeout(400)
        rig(f'room={code}&name=Priya&idle=4'); await a.wait_for_timeout(300); print('after 4 missed turns, ✕ shown:', await a.locator('.seat-x').count()); assert await a.locator('.seat-x').count()==0
        rig(f'room={code}&name=Priya&idle=5'); await a.wait_for_timeout(400)
        print('after 5: ✕ for Arun', await a.locator('.seat-x').count(), '| for Kiran (not host)', await o['Kiran'].locator('.seat-x').count(), '| for Priya herself', await o['Priya'].locator('.seat-x').count(), '| for the watcher', await w.locator('.seat-x').count())
        assert await a.locator('.seat-x').count()==1 and await o['Kiran'].locator('.seat-x').count()==1 and await o['Priya'].locator('.seat-x').count()==0 and await w.locator('.seat-x').count()==0
        print('Priya is told:', (await o['Priya'].text_content('#toast')).strip())
        size=await a.evaluate("(()=>{const x=document.querySelector('.seat-x'); const r=x.getBoundingClientRect(), s=x.closest('.seat').dataset.name; return [s, r.top>=50, r.left>=0]})()"); print('✕ is on:', size); assert size[0]=='Priya' and size[1] and size[2]
        await a.screenshot(path='idle_x.png')
        k=o['Kiran']; await k.click('.seat-x', force=True); await k.wait_for_timeout(200)
        print('asks first:', await k.is_visible('#kickConfirm'), '|', await k.text_content('#kickText')); assert await k.is_visible('#kickConfirm')
        await k.screenshot(path='idle_confirm.png')
        await k.click('#kickNo'); await k.wait_for_timeout(200); print('cancel keeps her in:', await a.locator('#seats .seat', has_text='Priya').count()==1); assert await a.locator('#seats .seat', has_text='Priya').count()==1
        await k.click('.seat-x', force=True); await k.click('#kickYes'); await a.wait_for_timeout(600)
        print('removed: seats Arun sees ->', await a.evaluate("[...document.querySelectorAll('#seats .seat')].map(s=>s.dataset.name)"), '| log:', (await a.text_content('#logLine')).strip())
        assert 'Priya' not in await a.evaluate("[...document.querySelectorAll('#seats .seat')].map(s=>s.dataset.name)")
        print('Priya is back on the home screen:', await o['Priya'].is_visible('#home'), '|', (await o['Priya'].text_content('#toast')).strip()); assert await o['Priya'].is_visible('#home')
        pr=o['Priya']; await pr.goto(BASE+'?room='+code); await pr.wait_for_timeout(800)
        if await pr.is_visible('#nameGo'): await pr.click('#nameGo')
        elif await pr.is_visible('#inviteJoin'): await pr.click('#inviteJoin')
        await pr.wait_for_selector('#game:not(.hidden)'); print('she can rejoin with the link, watching:', await pr.is_visible('#watchNote')); assert await pr.is_visible('#watchNote')
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
