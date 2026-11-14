# Join stats: joins are logged with name + city, the stats page needs the password, the home screen says so.
# Needs the stand-in running (its stats password is test-stats-key-123; location is set with /__test/geo).
import asyncio, urllib.request, urllib.error, json
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
def geo(city,region,country): urllib.request.urlopen(BASE+f'__test/geo?city={city}&region={region}&country={country}').read()
def api(key):
    try: return urllib.request.urlopen(urllib.request.Request(BASE+'api/stats', headers={'x-stats-key':key})).status
    except urllib.error.HTTPError as e: return e.code
async def newpage(b, w=390, h=780):
    ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('api without / wrong / right password:', api(''), api('nope'), api('test-stats-key-123')); assert (api(''), api('nope'), api('test-stats-key-123'))==(404,404,200)
        geo('Bengaluru','Karnataka','IN')
        a=await newpage(b); await a.goto(BASE)
        note=await a.text_content('.privacy-note'); print('home notice:', note); assert 'approximate city' in note and await a.is_visible('.privacy-note')
        await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip()
        geo('Mysuru','Karnataka','IN')
        q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        await q.reload(); await q.wait_for_selector('#lobby:not(.hidden)'); await q.wait_for_timeout(500)   # a reconnect must not count again
        rows=json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'api/stats', headers={'x-stats-key':'test-stats-key-123'})).read())['rows']
        mine=[r for r in rows if r['name'] in ('Arun','Priya')][:2]; print('logged:', [(r['name'],r['city'],r['kind']) for r in mine])
        assert [(r['name'],r['city'],r['kind']) for r in mine]==[('Priya','Mysuru','join'),('Arun','Bengaluru','create')]
        assert sum(1 for r in rows if r['name']=='Priya' and r['at']>=mine[1]['at'])==1
        s=await newpage(b); await s.goto(BASE+'stats.html')
        await s.fill('#key','wrong'); await s.click('#go'); await s.wait_for_timeout(400)
        print('wrong password:', await s.text_content('#msg'), '| stats hidden:', not await s.is_visible('#stats')); assert not await s.is_visible('#stats')
        await s.fill('#key','test-stats-key-123'); await s.click('#go'); await s.wait_for_selector('#stats:not(.hidden)')
        print('summary:', await s.text_content('#tJoins'), 'joins,', await s.text_content('#tNames'), 'names,', await s.text_content('#tCities'), 'cities')
        print('by city:', await s.locator('#byCity tr').all_text_contents())
        print('recent:', (await s.locator('#recent tr').all_text_contents())[:2])
        assert 'Mysuru' in await s.text_content('#byCity') and 'Priya' in await s.text_content('#recent')
        await s.screenshot(path='stats_page.png', full_page=True); await a.goto(BASE); await a.wait_for_timeout(500); await a.screenshot(path='stats_notice.png', full_page=True)
        await s.reload(); await s.wait_for_selector('#stats:not(.hidden)'); print('stays logged in on this device: True')
        await s.click('#logout'); print('after log out, stats hidden:', not await s.is_visible('#stats'))
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
