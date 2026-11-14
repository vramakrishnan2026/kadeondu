# Table redesign: opponents as fans of face-down cards (no circles, no seat for you), scores under names once
# someone has points, your own card count by the mic, and the fixed Catch! button. Needs the stand-in running.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'; errs=[]
def rig(q): urllib.request.urlopen(BASE+'__test/rig?'+q).read()
async def newpage(b,w=390,h=780):
    pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        a=await newpage(b); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip(); others=[]
        for n in ('Priya','Kiran'):
            q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput',n); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)'); others.append(q)
        await a.click('#addBotBtn'); await a.wait_for_timeout(300)
        await a.select_option('#turnTimeInput','0'); await a.click('#startBtn'); await a.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(1200)
        seats=await a.evaluate("[...document.querySelectorAll('#seats .seat')].map(s=>({name:s.querySelector('.sname').textContent, cards:s.querySelectorAll('.fc').length, count:+s.dataset.count, score:!!s.querySelector('.sscore')}))")
        print('seats:', seats); assert len(seats)==3 and all(s['cards']==7 and not s['score'] for s in seats) and not any(s['name'] in ('Arun','You') for s in seats)
        assert any(s['name'].startswith('🤖') for s in seats)
        print('no circles:', await a.locator('.avatar').count()==0, '| card back has no name text showing:', not await a.locator('#drawPile span').is_visible())
        info=await a.text_content('#myInfo'); print('my info:', info); assert info=='7 cards'
        st=await a.evaluate("['catchBtn','callBtn','drawBtn'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,Math.round(r.width),Math.round(r.height),Math.round(r.top),e.disabled]})"); print('buttons:', st)
        assert st[0][3]==st[1][3]==st[2][3] and st[1][2]==st[2][2]>=48 and abs(st[1][1]-st[2][1])<=2 and st[0][4] and st[1][4]   # one row, Ondu! and Draw the same size, Catch! and Ondu! grey
        mic=await a.evaluate("(()=>{const m=document.getElementById('micBtn').getBoundingClientRect(), d=document.getElementById('drawBtn').getBoundingClientRect(); return [Math.round(m.top)>Math.round(d.bottom), Math.round(innerWidth-m.right)<16]})()"); print('mic on the second row, far right:', mic); assert all(mic)
        # someone forgets to call: Catch! lights up in its fixed place, for everyone but them
        rig(f'room={code}&name=Priya'); await a.wait_for_timeout(400)
        print('catch enabled for Arun:', await a.is_enabled('#catchBtn'), '| for Kiran:', await others[1].is_enabled('#catchBtn'), '| for Priya herself:', await others[0].is_enabled('#catchBtn'))
        assert await a.is_enabled('#catchBtn') and await others[1].is_enabled('#catchBtn') and not await others[0].is_enabled('#catchBtn')
        await a.screenshot(path='table_catch.png')
        await a.click('#catchBtn', force=True); await a.wait_for_timeout(500)   # force: the button pulses
        pr=await a.evaluate("+[...document.querySelectorAll('#seats .seat')].find(s=>s.dataset.name==='Priya').dataset.count"); print('Priya after being caught:', pr, 'cards | catch grey again:', not await a.is_enabled('#catchBtn')); assert pr==9 and not await a.is_enabled('#catchBtn')
        fan=await a.evaluate("(()=>{const s=[...document.querySelectorAll('#seats .seat')].find(s=>s.dataset.name==='Priya'); return [s.querySelectorAll('.fc').length, s.querySelector('.more')?.textContent]})()"); print('fan for 9 cards:', fan); assert fan==[7,'+2']
        # scores appear under names once someone has points
        rig(f'room={code}&name=Kiran&score=45'); rig(f'room={code}&name=Arun&score=12'); await a.wait_for_timeout(400)
        print('scores under names:', await a.locator('#seats .sscore').all_text_contents(), '| mine:', await a.text_content('#myInfo'))
        assert '45 pts' in await a.locator('#seats .sscore').all_text_contents() and (await a.text_content('#myInfo'))=='7 cards · 12 pts'
        fits=await a.evaluate("document.documentElement.scrollHeight<=innerHeight"); print('no scrolling:', fits); assert fits
        await a.screenshot(path='table_scores.png')
        # left-handed: Draw moves to the left thumb, mic to the far left
        await a.evaluate("document.body.classList.add('lefty')"); await a.wait_for_timeout(200)
        l=await a.evaluate("(()=>{const x=id=>document.getElementById(id).getBoundingClientRect(); return [x('drawBtn').left<x('callBtn').left, x('callBtn').left<x('catchBtn').left, x('micBtn').left<16]})()"); print('left-handed mirrored:', l); assert all(l)
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
