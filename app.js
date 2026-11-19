'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const icons = name => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('aria-hidden','true'); const u = document.createElementNS(s.namespaceURI,'use'); u.setAttribute('href', '#' + name); s.append(u); return s; };
  const artists = ['Billie Eilish','The Weeknd','Sabrina Carpenter','Benson Boone','Tate McRae','Dua Lipa','ANNA ASTI','Моя Мишель'];
  const audio = $('audio');
  let results = [], favorites = [], queue = [], current = null, visible = 12, mode = 'search', requestNumber = 0, searching = false, lastTerm = '', lastCountry = '', toastTimer;
  const safeURL = (value, hosts) => { try { const u = new URL(value); return u.protocol === 'https:' && hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : ''; } catch { return ''; } };
  const clean = item => {
    if (!item || !Number.isSafeInteger(item.trackId) || item.trackId <= 0 || !item.trackName || !item.artistName) return null;
    return { trackId:item.trackId, trackName:String(item.trackName).slice(0,250), artistName:String(item.artistName).slice(0,250), previewUrl:safeURL(item.previewUrl,['mzstatic.com','itunes.apple.com']), artworkUrl100:safeURL(item.artworkUrl100,['mzstatic.com']), trackViewUrl:safeURL(item.trackViewUrl,['music.apple.com','itunes.apple.com']) };
  };
  try { const saved = JSON.parse(localStorage.getItem('volna-favorites-v1') || '[]'); if (Array.isArray(saved)) favorites = saved.slice(0,300).map(clean).filter(Boolean); } catch { /* Private browsing or unavailable storage: keep this session usable. */ }
  const notify = message => { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); };
  const time = n => Number.isFinite(n) ? Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2,'0') : '0:00';
  const isFavorite = track => favorites.some(f => f.trackId === track.trackId);
  function saveFavorite(track) {
    const saved = isFavorite(track);
    if (saved) favorites = favorites.filter(f => f.trackId !== track.trackId);
    else { if (favorites.length >= 300) { notify('В избранном уже 300 песен. Удали одну, чтобы добавить новую.'); return; } favorites.unshift(track); }
    try { localStorage.setItem('volna-favorites-v1', JSON.stringify(favorites)); } catch { notify('Браузер не разрешает сохранение. Избранное доступно только до закрытия страницы.'); }
    updateCount(); render();
  }
  function updateCount() { $('fav-count').textContent = favorites.length; }
  function setIcon(button, name) { button.replaceChildren(icons(name)); }
  function syncPlayer() {
    const playing = !audio.paused && !audio.ended;
    setIcon($('play-toggle'), playing ? 'pause' : 'play');
    $('play-toggle').setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
    for (const card of $('results').children) {
      const active = current && Number(card.dataset.id) === current.trackId;
      card.classList.toggle('current', Boolean(active));
      const button = card.querySelector('.card-play');
      if (button) { setIcon(button, active && playing ? 'pause' : 'play'); button.setAttribute('aria-label', (active && playing ? 'Пауза: ' : 'Слушать превью: ') + card.dataset.title); }
    }
  }
  function artwork(track, size) {
    if (!track.artworkUrl100) return null;
    const img = document.createElement('img');
    img.src = track.artworkUrl100.replace(/100x100bb/, size + 'x' + size + 'bb');
    img.alt = ''; img.loading = 'lazy'; img.addEventListener('error', () => img.remove(), {once:true});
    return img;
  }
  function render() {
    const list = mode === 'favorites' ? favorites : results;
    const fragment = document.createDocumentFragment();
    for (const track of list.slice(0,visible)) {
      const card = document.createElement('article'); card.className = 'track-card'; card.dataset.id = track.trackId; card.dataset.title = track.trackName;
      const art = document.createElement('div'); art.className = 'artwork'; art.append(icons('note')); const image = artwork(track,400); if(image) art.append(image);
      const play = document.createElement('button'); play.className = 'card-play'; play.type = 'button'; play.disabled = !track.previewUrl; play.setAttribute('aria-label','Слушать превью: ' + track.trackName); play.append(icons('play')); play.addEventListener('click',() => playTrack(track,list)); art.append(play);
      const title = document.createElement('h3'); title.className = 'track-title'; title.textContent = track.trackName; title.title = track.trackName;
      const artist = document.createElement('span'); artist.className = 'track-artist'; artist.textContent = track.artistName; artist.title = track.artistName;
      const bottom = document.createElement('div'); bottom.className = 'card-bottom';
      const badge = document.createElement('span'); badge.className = 'preview-badge'; badge.textContent = track.previewUrl ? 'ПРЕВЬЮ' : 'БЕЗ ПРЕВЬЮ'; bottom.append(badge);
      const heart = document.createElement('button'); heart.type = 'button'; heart.className = 'icon-button favorite' + (isFavorite(track) ? ' saved' : ''); heart.setAttribute('aria-pressed',String(isFavorite(track))); heart.setAttribute('aria-label',(isFavorite(track) ? 'Убрать из избранного: ' : 'В избранное: ') + track.trackName); heart.append(icons('heart')); heart.addEventListener('click',() => saveFavorite(track)); bottom.append(heart);
      if (track.trackViewUrl) { const link = document.createElement('a'); link.className = 'icon-button'; link.href = track.trackViewUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label','Открыть ' + track.trackName + ' в Apple Music, новая вкладка'); link.title = 'Полная песня в Apple Music'; link.append(icons('external')); bottom.append(link); }
      card.append(art,title,artist,bottom); fragment.append(card);
    }
    $('results').replaceChildren(fragment);
    $('more').hidden = list.length <= visible;
    $('result-count').textContent = list.length ? list.length + ' композиций' : '';
    if (mode === 'favorites') $('status').textContent = favorites.length ? '' : 'Здесь будут любимые песни. Нажми на сердечко рядом с песней — она сохранится в этом браузере.';
    syncPlayer();
  }
  function showMode(next) {
    mode = next;
    $('favorites-nav').classList.toggle('active', next === 'favorites');
    $('home-nav').classList.toggle('active',next === 'search');
    $('section-label').textContent = next === 'favorites' ? 'ТВОЯ КОЛЛЕКЦИЯ' : 'ПОИСК МУЗЫКИ';
    $('results-title').textContent = next === 'favorites' ? 'Твоё избранное' : (lastTerm ? 'Результаты: ' + lastTerm : 'Слушай то, что нравится');
    if(next === 'favorites') { $('status').textContent = ''; visible = 12; }
    else if(searching) $('status').textContent = 'Ищем музыку в каталоге…';
    else $('status').textContent = results.length ? '' : (lastTerm ? 'Ничего не найдено. Попробуй другое имя или регион каталога.' : 'Введи имя исполнителя или выбери его выше.');
    render();
  }
  function searchCatalog(term, country) {
    return new Promise((resolve,reject) => {
      // iTunes Search API officially supports cross-origin JSONP; no API key is required.
      const callback = 'volna_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script'); let settled = false;
      const cleanup = () => { clearTimeout(timer); script.remove(); window[callback] = () => {}; setTimeout(() => { delete window[callback]; },60000); };
      const finish = (error,data) => { if(settled) return; settled=true; cleanup(); error ? reject(error) : resolve(data); };
      const timer = setTimeout(() => finish(new Error('timeout')),15000);
      window[callback] = data => finish(null,data);
      script.onerror = () => finish(new Error('network'));
      const url = new URL('https://itunes.apple.com/search'); url.search = new URLSearchParams({term,country,media:'music',entity:'song',limit:'60',explicit:'No',callback}).toString();
      script.src = url.href; script.referrerPolicy = 'no-referrer'; document.head.append(script);
    });
  }
  async function search(term) {
    term = term.trim().slice(0,120); if(!term) { $('query').focus(); return; }
    const id = ++requestNumber; lastTerm = term; lastCountry = $('country').value; results = []; visible = 12; searching = true;
    $('query').value = term; showMode('search');
    document.querySelectorAll('.artist-chip').forEach(b => b.classList.toggle('selected', b.textContent === term));
    const url = new URL(location.href); url.searchParams.set('q',term); url.searchParams.set('country',lastCountry); history.replaceState(null,'',url);
    try {
      const data = await searchCatalog(term,lastCountry); if(id !== requestNumber) return;
      if(!data || !Array.isArray(data.results)) throw new Error('invalid');
      const seen = new Set(); results = data.results.map(clean).filter(t => t && !seen.has(t.trackId) && seen.add(t.trackId));
      searching = false;
      if(mode === 'search') { $('status').textContent = results.length ? '' : 'Ничего не найдено. Попробуй другой запрос или смени регион каталога.'; render(); }
    } catch {
      if(id !== requestNumber) return; searching = false;
      if(mode !== 'search') return;
      $('status').textContent = 'Каталог не ответил. Проверь интернет, попробуй другой регион или повтори поиск через минуту.';
      const retry = document.createElement('button'); retry.className = 'secondary'; retry.textContent = 'Повторить'; retry.addEventListener('click',() => search(term)); $('status').append(retry);
    }
  }
  async function startAudio() {
    try { await audio.play(); } catch (error) { if(error.name !== 'AbortError') notify('Не удалось включить фрагмент. Попробуй ещё раз или выбери другую песню.'); }
    syncPlayer();
  }
  function playTrack(track,list) {
    if(!track.previewUrl) { notify('Для этой песни нет превью. Можно открыть её в Apple Music.'); return; }
    if(current && current.trackId === track.trackId) { if(audio.paused) startAudio(); else audio.pause(); return; }
    queue = list.filter(t => t.previewUrl); current = track;
    audio.src = track.previewUrl;
    $('player-title').textContent = track.trackName; $('player-artist').textContent = track.artistName;
    const image = artwork(track,100); $('player-art').replaceChildren(image || icons('note'));
    ['play-toggle','seek'].forEach(id => $(id).disabled = false);
    $('previous').disabled = queue.length < 2; $('next').disabled = queue.length < 2;
    $('current-time').textContent = '0:00'; $('duration').textContent = '0:00'; $('seek').value = 0;
    startAudio(); syncPlayer();
  }
  function skip(direction) { if(!current || queue.length < 2) return; const index = queue.findIndex(t => t.trackId === current.trackId); playTrack(queue[(index + direction + queue.length) % queue.length],queue); }
  $('play-toggle').addEventListener('click',() => { if(!current) return; if(audio.paused) startAudio(); else audio.pause(); });
  $('previous').addEventListener('click',() => skip(-1)); $('next').addEventListener('click',() => skip(1));
  ['play','pause','ended'].forEach(event => audio.addEventListener(event,syncPlayer));
  audio.addEventListener('error',() => { if(current) notify('Этот фрагмент сейчас недоступен. Выбери другую песню.'); syncPlayer(); });
  audio.addEventListener('loadedmetadata',() => { $('duration').textContent = time(audio.duration); });
  audio.addEventListener('timeupdate',() => { $('current-time').textContent = time(audio.currentTime); $('seek').value = audio.duration ? audio.currentTime / audio.duration * 100 : 0; });
  $('seek').addEventListener('input',() => { if(Number.isFinite(audio.duration)) audio.currentTime = Number($('seek').value) / 100 * audio.duration; });
  audio.volume = 0.7; $('volume').addEventListener('input',() => { audio.volume = Number($('volume').value); });
  $('search-form').addEventListener('submit',event => { event.preventDefault(); search($('query').value); });
  $('country').addEventListener('change',() => { if($('query').value.trim()) search($('query').value); });
  $('more').addEventListener('click',() => { visible += 12; render(); });
  const scrollToSearch = () => { showMode('search'); $('search-form').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'center'}); $('query').focus({preventScroll:true}); };
  $('discover').addEventListener('click',scrollToSearch); $('search-nav').addEventListener('click',scrollToSearch);
  $('home-nav').addEventListener('click',() => { showMode('search'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('favorites-nav').addEventListener('click',() => { showMode('favorites'); $('results-title').scrollIntoView({block:'start',behavior:'smooth'}); });
  for (const artist of artists) { const button = document.createElement('button'); button.className = 'artist-chip'; button.textContent = artist; button.addEventListener('click',() => search(artist)); $('artist-chips').append(button); }
  updateCount();
  const params = new URLSearchParams(location.search);
  if(['US','RU','GB'].includes(params.get('country'))) $('country').value = params.get('country');
  if(params.get('q')) search(params.get('q')); else showMode('search');
})();
