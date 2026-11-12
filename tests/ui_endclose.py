import asyncio, random
from playwright.async_api import async_playwright
from ui_bots import human_turns, newpage, errs
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        host=await newpage(b); await host.goto(BASE); await host.fill('#nameInput','Arun'); await host.click('#nameGo'); await host.click('#createBtn'); await host.wait_for_selector('#lobby:not(.hidden)')
        await host.select_option('#handSizeInput','5'); await host.select_option('#turnTimeInput','0'); await host.wait_for_timeout(200)
        code=(await host.text_content('#lobbyCode')).strip()
        guest=await newpage(b); await guest.goto(BASE+'?room='+code); await guest.fill('#nameInput','Priya'); await guest.click('#nameGo'); await guest.wait_for_selector('#lobby:not(.hidden)')
        await host.click('#startBtn'); await guest.wait_for_selector('#game:not(.hidden)')
        print('ended:', await human_turns(host,[guest],600))
        await guest.wait_for_selector('#endOverlay:not(.hidden)')
        print('guest close visible:', await guest.is_visible('#closeEnd'))
        await guest.click('#closeEnd'); await guest.wait_for_timeout(200)
        print('after close: overlay hidden', not await guest.is_visible('#endOverlay'), '| scores btn', await guest.is_visible('#scoresBtn'), '| next-round btn (guest)', await guest.is_visible('#nextRoundBarBtn'))
        await guest.screenshot(path='end_closed.png')
        await guest.click('#scoresBtn'); await guest.wait_for_timeout(200); print('reopened:', await guest.is_visible('#endOverlay'))
        await host.click('#closeEnd'); await host.wait_for_timeout(200); print('host bar next-round:', await host.is_visible('#nextRoundBarBtn'))
        await host.click('#nextRoundBarBtn'); await guest.wait_for_timeout(500)
        print('round 2 started for guest: overlay hidden', not await guest.is_visible('#endOverlay'), '| scores btn hidden', not await guest.is_visible('#scoresBtn'), '| cards', await guest.locator('#hand .card').count())
        print('errors', errs); await b.close()
asyncio.run(main())
