# Room chat: tab at the edge with a dot for new messages, drawer, everyone in the room (watchers too), history for
# late joiners, wiped when the room empties, none in Play vs computer. Needs the stand-in running.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'; errs=[]
async def newpage(b,w=390,h=780):
    pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
async def say(pg, text):
    if not await pg.is_visible('#chat.open'): await pg.click('#chatTab')
    await pg.fill('#chatInput', text); await pg.press('#chatInput','Enter'); await pg.wait_for_timeout(250)
msgs=lambda pg: pg.locator('#chatList .chat-msg').all_text_contents()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        home=await newpage(b); await home.goto(BASE); print('no chat tab on the home screen:', not await home.is_visible('#chatTab')); assert not await home.is_visible('#chatTab')
        a=await newpage(b); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip()
        q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        print('tab in the waiting room:', await a.is_visible('#chatTab'), '| dot:', await a.is_visible('#chatDot')); assert await a.is_visible('#chatTab') and not await a.is_visible('#chatDot')
        await say(a, 'who is sitting on all the blues??'); await q.wait_for_timeout(300)
        print('Priya gets a dot:', await q.is_visible('#chatDot'), '| Arun (sender, chat open) does not:', not await a.is_visible('#chatDot')); assert await q.is_visible('#chatDot')
        await a.click('#chatClose'); await a.wait_for_timeout(300); assert not await a.is_visible('#chat.open') and await a.is_visible('#chatTab')
        await q.click('#chatTab'); await q.wait_for_timeout(300); print('opening clears the dot:', not await q.is_visible('#chatDot'), '| Priya reads:', await msgs(q))
        assert (await msgs(q))==['Arunwho is sitting on all the blues??']
        await say(q, '<b>not</b> me 😇'); await a.wait_for_timeout(300)
        print('Arun dot:', await a.is_visible('#chatDot'), '| html is shown as text:', await q.locator('#chatList b', has_text='not').count()==0); assert await a.is_visible('#chatDot')
        await q.click('#chatBack', position={'x':10,'y':300}); await q.wait_for_timeout(300); print('tap outside closes it:', not await q.is_visible('#chat.open')); assert not await q.is_visible('#chat.open')
        # start the round; a late joiner watches, sees the history and can post
        await a.select_option('#turnTimeInput','0'); await a.click('#startBtn'); await q.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(800)
        box=await a.evaluate("(()=>{const t=document.getElementById('chatTab').getBoundingClientRect(), r=document.getElementById('ring').getBoundingClientRect(); const hit=[...document.querySelectorAll('#seats .seat .fan, #seats .sname, .act-main button')].some(e=>{const x=e.getBoundingClientRect(); return x.right>t.left&&x.bottom>t.top&&x.top<t.bottom}); return [Math.round(innerWidth-t.right), t.bottom<=r.bottom+1, hit]})()")
        print('tab during the round: at the right edge', box[0]==0, '| inside the table area', box[1], '| covers a fan or button', box[2]); assert box[0]==0 and box[1] and not box[2]
        print('no scrolling with the tab:', await a.evaluate("document.documentElement.scrollHeight<=innerHeight"))
        await a.screenshot(path='chat_tab.png')
        k=await newpage(b); await k.goto(BASE+'?room='+code); await k.fill('#nameInput','Kiran'); await k.click('#nameGo'); await k.wait_for_selector('#game:not(.hidden)'); await k.wait_for_timeout(500)
        print('Kiran is watching:', await k.is_visible('#watchNote'), '| no dot for old messages:', not await k.is_visible('#chatDot'))
        await k.click('#chatTab'); await k.wait_for_timeout(300); print('Kiran scrolls back:', await msgs(k)); assert len(await msgs(k))==2
        await say(k, 'deal me in next round'); await a.wait_for_timeout(300); await a.click('#chatTab'); await a.wait_for_timeout(300)
        print('Arun reads:', (await msgs(a))[-1]); assert (await msgs(a))[-1]=='Kiran · watchingdeal me in next round'
        await say(a, 'ok'); await a.screenshot(path='chat_open.png')
        w=await a.evaluate("(()=>{const c=document.getElementById('chat').getBoundingClientRect(); return [Math.round(c.right)===innerWidth, c.width<innerWidth, Math.round(c.height)===innerHeight]})()"); print('drawer on the right, not full width, full height:', w); assert all(w)
        await a.mouse.move(200,400); await a.mouse.down(); await a.mouse.move(330,400, steps=4); await a.mouse.up(); await a.wait_for_timeout(350); print('pushed back to the edge by a swipe:', not await a.is_visible('#chat.open')); assert not await a.is_visible('#chat.open')
        # a refresh keeps the chat; left-handed puts the tab on the left
        await q.reload(); await q.wait_for_selector('#game:not(.hidden)'); await q.wait_for_timeout(500); await q.click('#chatTab'); await q.wait_for_timeout(300); print('after a refresh Priya still has:', len(await msgs(q)), 'messages'); assert len(await msgs(q))==4
        await q.click('#chatClose'); await q.evaluate("document.body.classList.add('lefty')"); await q.wait_for_timeout(200); print('left-handed tab at the left edge:', await q.evaluate("document.getElementById('chatTab').getBoundingClientRect().left")==0)
        # nobody connected for more than 5 minutes: wiped
        left=urllib.request.urlopen(BASE+'__test/chatempty?room='+code+'&min=2').read().decode(); print('people still connected, wake-up leaves the chat alone:', left); assert left=='4'
        for pg in (a,q,k): await pg.context.close()
        await home.wait_for_timeout(600)
        left=urllib.request.urlopen(BASE+'__test/chatempty?room='+code+'&min=6').read().decode(); print('messages left after 6 minutes empty:', left); assert left=='0'
        # Play vs computer has no chat
        s=await newpage(b); await s.goto(BASE); await s.fill('#nameInput','Vinay'); await s.click('#nameGo'); await s.click('#soloBtn'); await s.click('#soloStart'); await s.wait_for_selector('#game:not(.hidden)'); await s.wait_for_timeout(600)
        print('Play vs computer has no chat tab:', not await s.is_visible('#chatTab')); assert not await s.is_visible('#chatTab')
        sm=await newpage(b,360,640); await sm.goto(BASE); await sm.fill('#nameInput','Asha'); await sm.click('#nameGo'); await sm.click('#createBtn'); await sm.wait_for_selector('#lobby:not(.hidden)'); await sm.click('#chatTab'); await sm.wait_for_timeout(300)
        await sm.fill('#chatInput','x'*250); print('typing box stops at', len(await sm.input_value('#chatInput')), 'characters'); await sm.screenshot(path='chat_small.png')
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
