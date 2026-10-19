"""Offline DOM fixture: in-memory Storage + single-page Locks mocks, NOT live DSH.
Run with Python Playwright and Chromium, after npm run build.
"""
import os, re, json
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, timezone_id='Asia/Shanghai')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    at = datetime(2026,10,19,2,0,tzinfo=timezone.utc)
    page.clock.install(time=at)
    page.clock.pause_at(at)
    html = re.sub(r'<script[^>]*>.*?</script>', '', (ROOT/'preview/index.html').read_text())
    page.set_content(html)
    page.evaluate('''() => {
      const data = new Map();
      Object.defineProperty(window, 'localStorage', {value:{
        getItem(k){return data.get(k)??null},setItem(k,v){data.set(k,String(v))},removeItem(k){data.delete(k)}
      }, configurable:true});
      Object.defineProperty(navigator, 'locks', {value:{request:async(name,opts,callback)=>callback({name})}, configurable:true});
    }''')
    page.add_script_tag(content=(ROOT/'preview/demo.js').read_text())
    page.add_script_tag(content=(ROOT/'lib/client.js').read_text())
    page.wait_for_selector('#dsh-mo-widget')
    page.locator('#settings').click()
    page.locator('[name=monthlySalary]').fill('8000')
    page.locator('#form button[type=submit]').click()
    assert '空闲' in page.locator('#state').inner_text()
    checks.append('first-run settings and Shadow DOM render')
    page.evaluate("__moyuDemo.act('a-run')")
    page.clock.run_for(4999)
    assert page.locator('#paid').inner_text()=='00:00:00'
    page.clock.run_for(2001)
    assert page.locator('#paid').inner_text()=='00:00:02'
    checks.append('5-second boundary and live UI')
    page.evaluate("__moyuDemo.act('a-wait')")
    page.clock.run_for(10000)
    assert page.locator('#paid').inner_text()=='00:00:02'
    checks.append('running plus pending approval pauses')
    page.evaluate("__moyuDemo.act('a-run')")
    page.clock.run_for(10000)
    assert page.locator('#paid').inner_text()=='00:00:07'
    page.evaluate("__moyuDemo.act('b-run')")
    page.clock.run_for(7000)
    assert page.locator('#paid').inner_text()=='00:00:14'
    checks.append('resume threshold and parallel union')
    page.evaluate("__moyuDemo.act('offline')")
    page.clock.run_for(20000)
    assert page.locator('#paid').inner_text()=='00:00:14'
    page.evaluate("__moyuDemo.act('online')")
    page.clock.run_for(6000)
    assert page.locator('#paid').inner_text()=='00:00:15'
    checks.append('disconnect and fresh reconnect')
    page.evaluate("__moyuDemo.act('a-idle');__moyuDemo.act('b-idle')")
    page.locator('#collapse').click()
    assert page.locator('#reopen').is_visible()
    page.locator('#reopen').click()
    page.locator('#history').click()
    assert page.locator('#rows tr').count()==7
    page.locator('#back2').click()
    checks.append('collapse/reopen and seven-day history')
    # Explicit synthetic demo ledger, never claimed as real usage or persistence.
    page.evaluate("""() => { __moyuDemo.dispose(); const v=JSON.parse(localStorage.getItem('dsh-mo:v1'));const now=Date.now();v.intervals=[{start:now-45*60000,end:now}];localStorage.setItem('dsh-mo:v1',JSON.stringify(v)); }""")
    page.add_script_tag(content=(ROOT/'preview/demo.js').read_text())
    page.add_script_tag(content=(ROOT/'lib/client.js').read_text())
    assert page.locator('#paid').inner_text()=='00:45:00'
    assert '37.50' in page.locator('#value').inner_text()
    checks.append('remount restores confirmed intervals from mock Storage')
    page.screenshot(path=str(ROOT/'docs/preview.png'), full_page=True)
    page.evaluate('__moyuDemo.dispose()')
    assert page.locator('#dsh-mo-widget').count()==0
    assert page.evaluate('__moyuDemo.status.listeners.size')==0
    checks.append('unload removes widget and subscriptions')
    assert not errors, errors
    browser.close()
print(json.dumps({'passed':len(checks),'checks':checks,'browser_errors':errors,'fixture':'offline; mocked Storage and Locks'},ensure_ascii=False,indent=2))
