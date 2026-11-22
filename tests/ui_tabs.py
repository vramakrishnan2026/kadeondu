# Game tabs on the home screen: Kade Ondu and Ludo are games; Ondu Ruthless shows "Brewing…" until it is built.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(w=390,h=844):
            pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        a=await page(); await a.goto(BASE); await a.wait_for_timeout(400)
        tabs=[(await t.inner_text()).replace('\n',' / ') for t in await a.locator('#gameTabs .game-tab').all()]
        print('tabs:', tabs)
        print('first tab selected, game shown:', await a.get_attribute('.game-tab >> nth=0','aria-selected'), await a.is_visible('#nameStep'), not await a.is_visible('#brewing'), '| title:', await a.text_content('#homeTitle'))
        await a.screenshot(path='tabs1_home.png')
        # Ludo is a real game: its own title, tagline and "how it works" line, no Brewing notice
        await a.click('.game-tab >> nth=1'); await a.wait_for_timeout(300)
        print('Ludo: title', await a.text_content('#homeTitle'), '| no brewing', not await a.is_visible('#brewing'), '| name step', await a.is_visible('#nameStep'), '| tagline:', await a.text_content('.home-card .tagline'),
              '| how:', await a.locator('.how li:visible').last.inner_text())
        await a.screenshot(path='tabs2_ludo.png')
        for i,name in ((2,'Ondu Ruthless'),):
            await a.click(f'.game-tab >> nth={i}'); await a.wait_for_timeout(900)
            print(f'{name}: brewing shown', await a.is_visible('#brewing'), '| cup', await a.is_visible('#brewing .cup'), '| text:', ' '.join((await a.inner_text('#brewing')).split()),
                  '| game hidden', not await a.is_visible('#nameStep') and not await a.is_visible('#menu'), '| title:', await a.text_content('#homeTitle'),
                  '| selected', await a.get_attribute(f'.game-tab >> nth={i}','aria-selected'))
            await a.screenshot(path=f'tabs{i+1}_{name.split()[-1].lower()}.png')
        # the steam is moving
        async def steam(): return await a.evaluate("[...document.querySelectorAll('#brewing .steam path')].map(p => getComputedStyle(p).opacity + '|' + getComputedStyle(p).transform).join(' ')")
        s1=await steam(); await a.wait_for_timeout(700); s2=await steam(); print('steam animating:', s1!=s2)
        print('no scrolling sideways:', await a.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        # back to the game: by the button, and by the tab; the game still works
        await a.click('#brewBack'); await a.wait_for_timeout(200)
        print('Back button:', await a.is_visible('#nameStep'), not await a.is_visible('#brewing'), await a.text_content('#homeTitle'), '| tagline back', await a.is_visible('.tagline'))
        await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.wait_for_timeout(300)
        await a.click('.game-tab >> nth=2'); print('menu hidden while brewing:', not await a.is_visible('#menu'))
        await a.click('.game-tab >> nth=0'); print('menu back:', await a.is_visible('#menu'))
        await a.screenshot(path='tabs4_menu.png')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); print('new room still works: True')
        code=(await a.text_content('#lobbyCode')).strip()
        # an invite link opens on the game, not on a brewing tab; tabs fit a small phone
        n=await page(320,568); await n.goto(BASE+'?room='+code); await n.wait_for_timeout(400)
        print('invite link: game tab', await n.get_attribute('.game-tab >> nth=0','aria-selected'), await n.is_visible('#nameInvite'))
        widths=await n.evaluate("[...document.querySelectorAll('.game-tab')].map(b => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), b.querySelector('span').scrollWidth <= b.querySelector('span').clientWidth])")
        print('320px phone, tab [width, height, label fits]:', widths, '| no sideways scroll', await n.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await n.click('.game-tab >> nth=2'); await n.wait_for_timeout(600); await n.screenshot(path='tabs5_small.png')
        # leaving a room from a brewing tab is not possible, but joining resets the tab
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); print('after leaving: game tab', await a.get_attribute('.game-tab >> nth=0','aria-selected'))
        print('errors', errs); await b.close()
asyncio.run(main())
