# Poker: the coach watches each move and stops a mistake so it can be taken back.
# A friends' table with coach hints on and a fixed deal, then a table vs computer. Needs the stand-in.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name, guard=None):
            pg=await (await b.new_context(viewport={'width':390,'height':780})).new_page()
            pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            if guard: await pg.add_init_script("try { if (!localStorage.getItem('ko-poker')) localStorage.setItem('ko-poker', JSON.stringify({ guard: '%s' })) } catch (e) {}" % guard)
            await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(250); await pg.click('.game-tab[data-game="poker"]'); await pg.wait_for_timeout(250); return pg
        async def status(pg): return ' '.join((await pg.inner_text('#pkStatus')).split())
        a=await page('Arun'); k=await page('Kiran'); r=await page('Ravi', 'off')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        for q in (k,r): await q.wait_for_timeout(300); await q.click('#roomList li button'); await q.wait_for_selector('#lobby:not(.hidden)')
        await a.check('#pkCoachInput'); await a.select_option('#turnTimeInput','0'); await a.wait_for_timeout(200)
        # 3 players: Kiran small blind (aces), Ravi big blind (queen-jack), Arun on the button (seven-two)
        hit(f'__test/deck?room={code}&cards=As,Ah,Qc,Jd,7s,2d,Kc,8d,3c,5h,9s')
        await a.click('#startBtn'); await a.wait_for_selector('#poker:not(.hidden)'); await a.wait_for_timeout(600)
        print('Arun holds', await a.text_content('.pk-what'), '|', await status(a))
        await a.click('#pkCall'); await a.wait_for_timeout(300)
        print('calling with a weak hand: stopped', await a.is_visible('#pkGuard'), '|', await a.text_content('#pkGuardSub'), '| why:', (await a.locator('#pkGuardWhy li').all_inner_texts())[:2])
        await a.screenshot(path='guard1_stop.png')
        print('nothing sent yet: Kiran still waits', 'Arun' in await status(k))
        await a.click('#pkGuardBack'); await a.wait_for_timeout(300)
        print('taken back: still my turn', await a.is_enabled('#pkFold') and 'Your turn' in await status(a), '| toast', repr(await a.text_content('#toast')))
        await a.click('#pkFold'); await k.wait_for_timeout(500); print('folds instead: over to', await status(k))
        # Kiran just calls with aces: stopped; plays it anyway
        print('Kiran holds', await k.text_content('.pk-what'))
        await k.click('#pkCall'); await k.wait_for_timeout(300); print('calling with aces: stopped', await k.is_visible('#pkGuard'), '|', await k.text_content('#pkGuardSub'))
        await k.click('#pkGuardGo'); await r.wait_for_timeout(600); print('plays it anyway: over to Ravi', 'Your turn' in await status(r), '| pop-up gone', not await k.is_visible('#pkGuard'))
        # Ravi has it switched off on his phone: a loose move goes straight through
        await r.click('#pkBet'); await r.click('#pkRaise [data-size="max"]'); await r.click('#pkBet'); await r.wait_for_timeout(500)
        print('Ravi (off): all-in went straight through', not await r.is_visible('#pkGuard') and 'Your turn' not in await status(r))
        saved=await a.evaluate("JSON.parse(localStorage.getItem('ko-poker')).play"); print('Arun\'s phone:', {x: saved[x] for x in ('dec','match','saved')}, '| Kiran\'s slip counted', await k.evaluate("JSON.parse(localStorage.getItem('ko-poker')).play.slip"))
        # the pop-up lapses if the turn goes (here: Kiran is asked about calling the all-in, then folds by Back)
        # vs computer: the setting is in the set-up, on by default; "every difference" stops a small difference too
        s=await page('Sita')
        await s.click('#soloBtn'); print('vs computer: default setting', await s.input_value('#psoloGuard'))
        await s.select_option('#psoloGuard','every'); await s.select_option('#psoloCount','2'); await s.click('#psoloStart'); await s.wait_for_selector('#poker:not(.hidden)')
        stops=0; took=0
        for step in range(120):
            await s.wait_for_timeout(300)
            if await s.is_visible('#pkGuard'):
                stops+=1
                if stops==1: await s.screenshot(path='guard2_solo.png')
                if stops%2: await s.click('#pkGuardBack'); took+=1
                else: await s.click('#pkGuardGo')
            elif await s.is_visible('#pkNext'):
                if stops>=3: break
                await s.click('#pkNext')
            elif await s.is_visible('#pkCall') and await s.is_enabled('#pkCall'):
                coach=await s.text_content('#pkCoach') if await s.is_visible('#pkCoach') else ''
                # do the opposite of the coach where possible
                if 'Fold' in coach or 'Raise' in coach or 'Bet' in coach: await s.click('#pkCall')
                elif await s.is_enabled('#pkBet'): await s.click('#pkBet'); await s.click('#pkBet')
                else: await s.click('#pkCall')
        print('vs computer (every difference): stopped', stops, 'times, took back', took, '| saved on phone', await s.evaluate("JSON.parse(localStorage.getItem('ko-poker')).play.saved"), '| setting kept', await s.evaluate("JSON.parse(localStorage.getItem('ko-poker')).guard"))
        await s.click('#leaveBtn'); await s.wait_for_selector('#home:not(.hidden)'); print('plan shows it:', [t for t in await s.locator('#pkStats span').all_inner_texts() if 'taken back' in t])
        print('errors', errs); await b.close()
asyncio.run(main())
