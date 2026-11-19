'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const icon = name => { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('aria-hidden','true'); const use = document.createElementNS(svg.namespaceURI,'use'); use.setAttribute('href','#' + name); svg.append(use); return svg; };
  const audio = $('audio');
  let tracks = [], favorites = [], queue = [], current = null, mode = 'search', visible = 12, generation = 0, lastTerm = '', loading = false, failure = '', toastTimer;
  function trusted(value,domains) { try { const u = new URL(value); return u.protocol === 'https:' && domains.some(d => u.hostname === d || u.hostname.endsWith('.' + d)) ? u.href : ''; } catch { return ''; } }
  function clean(t) {
    if(!t || !Number.isSafeInteger(t.trackId) || t.trackId <= 0 || !t.trackName || !t.artistName) return null;
    return {trackId:t.trackId,trackName:String(t.trackName).slice(0,250),artistName:String(t.artistName).slice(0,250),previewUrl:trusted(t.previewUrl,['mzstatic.com','itunes.apple.com']),artworkUrl100:trusted(t.artworkUrl100,['mzstatic.com']),trackViewUrl:trusted(t.trackViewUrl,['music.apple.com','itunes.apple.com'])};
  }
  try { const saved = JSON.parse(localStorage.getItem('volna-favorites-v1') || '[]'); if(Array.isArray(saved)) favorites = saved.slice(0,300).map(clean).filter(Boolean); } catch {}
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true,5000); }
  function setIcon(button,name) { button.replaceChildren(icon(name)); }
  const time = n => Number.isFinite(n) ? Math.floor(n/60) + ':' + String(Math.floor(n%60)).padStart(2,'0') : '0:00';
  const saved = t => favorites.some(f => f.trackId === t.trackId);
  function image(t,size) { if(!t.artworkUrl100) return null; const img = document.createElement('img'); img.src = t.artworkUrl100.replace('100x100bb',size + 'x' + size + 'bb'); img.alt = ''; img.loading = 'lazy'; img.addEventListener('error',() => img.remove(),{once:true}); return img; }
  function sync() {
    const playing = !audio.paused && !audio.ended;
    setIcon($('play-toggle'),playing ? 'pause' : 'play'); $('play-toggle').setAttribute('aria-label',playing ? 'Пауза' : 'Воспроизвести');
    for(const card of $('results').children) { const active = current && Number(card.dataset.id) === current.trackId; card.classList.toggle('current',Boolean(active)); const button = card.querySelector('.card-play'); setIcon(button,active && playing ? 'pause' : 'play'); button.setAttribute('aria-label',(active && playing ? 'Пауза: ' : 'Слушать превью: ') + card.dataset.title); }
  }
  function favorite(t) {
    if(saved(t)) favorites = favorites.filter(f => f.trackId !== t.trackId);
    else { if(favorites.length >= 300) return toast('В избранном уже 300 песен. Сначала удали одну.'); favorites.unshift(t); }
    try { localStorage.setItem('volna-favorites-v1',JSON.stringify(favorites)); } catch { toast('Браузер запретил сохранение. Избранное останется только до закрытия страницы.'); }
    render();
  }
  function status() {
    $('status').replaceChildren();
    if(mode === 'favorites') { if(!favorites.length) $('status').textContent = 'Нажми сердечко на песне — она появится здесь и сохранится в этом браузере.'; return; }
    if(loading) { $('status').textContent = 'Ищем музыку… Если прямое подключение не ответит, попробуем резервный способ.'; return; }
    if(failure) {
      $('status').textContent = failure + ' Поиск не получил данные; это не означает, что исполнитель отсутствует.';
      const retry = document.createElement('button'); retry.className = 'secondary'; retry.textContent = 'Повторить'; retry.onclick = () => search(lastTerm); $('status').append(retry);
      const p = document.createElement('p'); p.textContent = 'Если ошибка повторяется, открой сайт в Safari или Chrome вне Telegram. Можно также проверить, открывается ли сам каталог: ';
      const link = document.createElement('a'); link.href = endpoint(lastTerm,$('country').value).href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Проверить доступ к каталогу Apple'; p.append(link); $('status').append(p); return;
    }
    if(!tracks.length) $('status').textContent = lastTerm ? 'Ничего не найдено. Попробуй другой запрос или регион каталога.' : 'Введи исполнителя или выбери его выше.';
  }
  function render() {
    $('fav-count').textContent = favorites.length;
    $('favorites-nav').classList.toggle('active',mode === 'favorites'); $('home-nav').classList.toggle('active',mode === 'search');
    $('section-label').textContent = mode === 'favorites' ? 'ТВОЯ КОЛЛЕКЦИЯ' : 'ПОИСК МУЗЫКИ';
    $('results-title').textContent = mode === 'favorites' ? 'Твоё избранное' : lastTerm ? 'Результаты: ' + lastTerm : 'Слушай то, что нравится';
    const list = mode === 'favorites' ? favorites : tracks, fragment = document.createDocumentFragment();
    for(const t of list.slice(0,visible)) {
      const card = document.createElement('article'); card.className = 'track-card'; card.dataset.id = t.trackId; card.dataset.title = t.trackName;
      const art = document.createElement('div'); art.className = 'artwork'; art.append(icon('note')); const img = image(t,400); if(img) art.append(img);
      const play = document.createElement('button'); play.className = 'card-play'; play.disabled = !t.previewUrl; play.onclick = () => playTrack(t,list); art.append(play);
      const title = document.createElement('h3'); title.className = 'track-title'; title.textContent = t.trackName; title.title = t.trackName;
      const artist = document.createElement('span'); artist.className = 'track-artist'; artist.textContent = t.artistName; artist.title = t.artistName;
      const bottom = document.createElement('div'); bottom.className = 'card-bottom'; const badge = document.createElement('span'); badge.className = 'preview-badge'; badge.textContent = t.previewUrl ? 'ПРЕВЬЮ' : 'БЕЗ ПРЕВЬЮ'; bottom.append(badge);
      const heart = document.createElement('button'); heart.className = 'icon-button favorite' + (saved(t) ? ' saved' : ''); heart.setAttribute('aria-pressed',String(saved(t))); heart.setAttribute('aria-label',(saved(t) ? 'Убрать из избранного: ' : 'В избранное: ') + t.trackName); heart.append(icon('heart')); heart.onclick = () => favorite(t); bottom.append(heart);
      if(t.trackViewUrl) { const a = document.createElement('a'); a.href = t.trackViewUrl; a.className = 'icon-button'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label','Открыть ' + t.trackName + ' в Apple Music'); a.append(icon('external')); bottom.append(a); }
      card.append(art,title,artist,bottom); fragment.append(card);
    }
    $('results').replaceChildren(fragment); $('more').hidden = list.length <= visible; $('result-count').textContent = list.length ? list.length + ' композиций' : ''; status(); sync();
  }
  function endpoint(term,country) { const url = new URL('https://itunes.apple.com/search'); url.search = new URLSearchParams({term,country,media:'music',entity:'song',limit:'30'}).toString(); return url; }
  function validate(data) { if(!data || !Array.isArray(data.results)) throw new Error('format'); return data; }
  async function jsonSearch(url) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),6500);
    try { const response = await fetch(url.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'}); if(!response.ok) throw new Error('HTTP ' + response.status); return validate(await response.json()); } finally { clearTimeout(timer); }
  }
  function jsonpSearch(url) {
    return new Promise((resolve,reject) => {
      const callback = 'volnaCallback' + Date.now() + Math.floor(Math.random()*1000000); const script = document.createElement('script'); let done = false;
      function finish(error,data) { if(done) return; done = true; clearTimeout(timer); script.remove(); window[callback] = () => {}; setTimeout(() => { delete window[callback]; },60000); if(error) reject(error); else { try { resolve(validate(data)); } catch(e) { reject(e); } } }
      const timer = setTimeout(() => finish(new Error('timeout')),12000);
      window[callback] = data => finish(null,data); script.onerror = () => finish(new Error('network'));
      const target = new URL(url.href); target.searchParams.set('callback',callback); script.src = target.href; script.referrerPolicy = 'no-referrer'; document.head.append(script);
    });
  }
  async function search(term) {
    term = term.trim().slice(0,120); if(!term) return $('query').focus();
    const id = ++generation, country = $('country').value; lastTerm = term; mode = 'search'; visible = 12; tracks = []; failure = ''; loading = true; $('query').value = term; render();
    document.querySelectorAll('.artist-chip').forEach(b => b.classList.toggle('selected',b.textContent === term));
    const locationURL = new URL(location.href); locationURL.searchParams.set('q',term); locationURL.searchParams.set('country',country); history.replaceState(null,'',locationURL);
    const url = endpoint(term,country);
    try {
      let data;
      try { data = await jsonSearch(url); }
      catch(e) { if(id !== generation) return; console.info('Volna: direct request unavailable; trying JSONP.',e.message); data = await jsonpSearch(url); }
      if(id !== generation) return;
      const seen = new Set(); tracks = data.results.map(clean).filter(t => t && !seen.has(t.trackId) && seen.add(t.trackId));
    } catch(e) { if(id !== generation) return; console.warn('Volna: catalog request failed.',e.message); failure = 'Не удалось подключиться к каталогу Apple двумя способами.'; }
    finally { if(id === generation) { loading = false; render(); } }
  }
  async function resume() { try { await audio.play(); } catch(e) { if(e.name !== 'AbortError') toast('Не удалось включить фрагмент. Попробуй другую песню или открой сайт в Safari.'); } sync(); }
  function playTrack(t,list) {
    if(!t.previewUrl) return toast('У этой песни нет доступного превью.');
    if(current && current.trackId === t.trackId) { if(audio.paused) resume(); else audio.pause(); return; }
    current = t; queue = list.filter(t => t.previewUrl); audio.src = t.previewUrl; $('player-title').textContent = t.trackName; $('player-artist').textContent = t.artistName; $('player-art').replaceChildren(image(t,100) || icon('note'));
    $('play-toggle').disabled = false; $('seek').disabled = false; $('next').disabled = queue.length < 2; $('previous').disabled = queue.length < 2; $('seek').value = 0; $('current-time').textContent = '0:00'; $('duration').textContent = '0:00'; resume(); sync();
  }
  function skip(direction) { if(!current || queue.length < 2) return; const index = queue.findIndex(t => t.trackId === current.trackId); playTrack(queue[(index + direction + queue.length)%queue.length],queue); }
  $('play-toggle').onclick = () => { if(!current) return; if(audio.paused) resume(); else audio.pause(); };
  $('previous').onclick = () => skip(-1); $('next').onclick = () => skip(1);
  ['play','pause','ended'].forEach(event => audio.addEventListener(event,sync)); audio.addEventListener('error',() => { if(current) toast('Этот фрагмент недоступен. Попробуй другую песню.'); sync(); });
  audio.addEventListener('loadedmetadata',() => $('duration').textContent = time(audio.duration));
  audio.addEventListener('timeupdate',() => { $('current-time').textContent = time(audio.currentTime); $('seek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime/audio.duration*100 : 0; });
  $('seek').oninput = () => { if(Number.isFinite(audio.duration)) audio.currentTime = Number($('seek').value)/100*audio.duration; };
  audio.volume = 0.7; $('volume').oninput = () => audio.volume = Number($('volume').value);
  $('search-form').onsubmit = e => { e.preventDefault(); search($('query').value); }; $('country').onchange = () => { if($('query').value.trim()) search($('query').value); };
  $('more').onclick = () => { visible += 12; render(); };
  const behavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  function focusSearch() { mode = 'search'; render(); $('search-form').scrollIntoView({behavior:behavior(),block:'center'}); $('query').focus({preventScroll:true}); }
  $('discover').onclick = focusSearch; $('search-nav').onclick = focusSearch;
  $('home-nav').onclick = () => { mode = 'search'; render(); window.scrollTo({top:0,behavior:behavior()}); };
  $('favorites-nav').onclick = () => { mode = 'favorites'; visible = 12; render(); $('results-title').scrollIntoView({block:'start',behavior:behavior()}); };
  for(const name of ['Billie Eilish','The Weeknd','Sabrina Carpenter','Benson Boone','Tate McRae','Dua Lipa','ANNA ASTI','Моя Мишель']) { const button = document.createElement('button'); button.className = 'artist-chip'; button.textContent = name; button.onclick = () => search(name); $('artist-chips').append(button); }
  const params = new URLSearchParams(location.search); if(['US','RU','GB'].includes(params.get('country'))) $('country').value = params.get('country');
  render(); if(params.get('q')) search(params.get('q'));
})();
