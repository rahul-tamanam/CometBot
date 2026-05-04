;(function () {
  const megaWrap = document.getElementById('mega-wrap')
  const primaryNav = document.getElementById('primary-nav')
  const audienceNav = document.getElementById('audience-nav')
  const audienceDetail = document.getElementById('audience-detail')
  const audiencePanelsRoot = document.getElementById('audience-panels')
  const btnRankings = document.getElementById('btn-rankings')
  const btnAcademic = document.getElementById('btn-academic')
  const rankingsSection = document.getElementById('rankings')
  const academicSection = document.getElementById('academic-areas')

  let openPanelId = null
  let audienceDrawerOpen = false
  let rankingsPlayed = false
  let rankingsObserver = null

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function panels() {
    return Array.from(document.querySelectorAll('.mega-panel'))
  }

  function showMega(panelKey) {
    if (!megaWrap) return
    megaWrap.hidden = false
    requestAnimationFrame(() => {
      megaWrap.classList.add('is-open')
    })

    panels().forEach((p) => {
      p.classList.toggle('is-active', p.id === `panel-${panelKey}`)
    })

    document.querySelectorAll('.primary-nav__item').forEach((li) => {
      const btn = li.querySelector('.primary-nav__trigger')
      const isMatch = li.getAttribute('data-panel') === panelKey
      li.classList.toggle('is-open', isMatch)
      if (btn) btn.setAttribute('aria-expanded', String(isMatch))
    })

    openPanelId = panelKey
  }

  function hideMega() {
    if (!megaWrap) return
    megaWrap.classList.remove('is-open')
    openPanelId = null
    document.querySelectorAll('.primary-nav__item').forEach((li) => {
      li.classList.remove('is-open')
      const btn = li.querySelector('.primary-nav__trigger')
      if (btn) btn.setAttribute('aria-expanded', 'false')
    })
    window.setTimeout(() => {
      if (!megaWrap.classList.contains('is-open')) {
        megaWrap.hidden = true
      }
    }, 420)
  }

  if (primaryNav && megaWrap) {
    primaryNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.primary-nav__trigger')
      if (!btn) return
      const item = btn.closest('.primary-nav__item')
      const key = item?.getAttribute('data-panel')
      if (!key) return

      if (openPanelId === key && megaWrap.classList.contains('is-open')) {
        hideMega()
      } else {
        showMega(key)
      }
    })

    primaryNav.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      hideMega()
      e.target.closest('.primary-nav__item')?.querySelector('.primary-nav__trigger')?.focus()
    })
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideMega()
      closeAudienceDrawer()
    }
  })

  document.addEventListener('click', (e) => {
    if (megaWrap?.classList.contains('is-open')) {
      if (!e.target.closest('#primary-nav') && !e.target.closest('#mega-wrap')) {
        hideMega()
      }
    }
    if (audienceDrawerOpen && audienceDetail && !e.target.closest('#audience-nav') && !e.target.closest('#audience-detail')) {
      closeAudienceDrawer()
    }
  })

  function setAudiencePanel(audienceKey) {
    if (!audiencePanelsRoot) return
    audiencePanelsRoot.querySelectorAll('.audience-panel').forEach((panel) => {
      const key = panel.getAttribute('data-audience-panel')
      const match = key === audienceKey
      if (match) {
        panel.removeAttribute('hidden')
      } else {
        panel.setAttribute('hidden', '')
      }
    })
  }

  function openAudienceDrawer(key) {
    if (!audienceDetail) return
    audienceDetail.removeAttribute('hidden')
    audienceDrawerOpen = true
    setAudiencePanel(key)
  }

  function closeAudienceDrawer() {
    if (!audienceDetail) return
    audienceDetail.setAttribute('hidden', '')
    audienceDrawerOpen = false
    audienceNav?.querySelectorAll('.audience-nav__link').forEach((x) => x.classList.remove('is-active'))
    audiencePanelsRoot?.querySelectorAll('.audience-panel').forEach((p) => p.setAttribute('hidden', ''))
  }

  if (audienceNav && audiencePanelsRoot && audienceDetail) {
    audiencePanelsRoot.querySelectorAll('.audience-panel').forEach((p) => p.setAttribute('hidden', ''))

    audienceNav.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-audience]')
      if (!a) return
      e.preventDefault()
      const key = a.getAttribute('data-audience')
      if (!key) return

      if (audienceDrawerOpen && a.classList.contains('is-active')) {
        closeAudienceDrawer()
        return
      }

      audienceNav.querySelectorAll('.audience-nav__link').forEach((x) => {
        x.classList.toggle('is-active', x === a)
      })

      openAudienceDrawer(key)

      if (!prefersReducedMotion()) {
        audienceDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }

  function animateCount(el, target, decimals) {
    const reduced = prefersReducedMotion()
    if (reduced) {
      el.textContent = decimals > 0 ? Number(target).toFixed(decimals) : String(Math.round(target))
      return
    }
    const duration = 900
    const start = performance.now()
    const from = 0

    function frame(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = from + (target - from) * eased
      el.textContent = decimals > 0 ? val.toFixed(decimals) : String(Math.round(val))
      if (t < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  function runRankingsAnimation() {
    const section = rankingsSection
    if (!section) return

    const cards = Array.from(section.querySelectorAll('.rank-card'))
    cards.forEach((card) => {
      card.classList.remove('is-visible')
      const numEl = card.querySelector('.rank-card__num[data-target]')
      if (numEl) numEl.textContent = '0'
    })

    rankingsPlayed = false
    if (rankingsObserver) {
      rankingsObserver.disconnect()
      rankingsObserver = null
    }

    rankingsObserver = new IntersectionObserver(
      (entries) => {
        if (rankingsPlayed) return
        if (!entries.some((e) => e.isIntersecting)) return
        rankingsPlayed = true
        cards.forEach((card, i) => {
          window.setTimeout(
            () => {
              card.classList.add('is-visible')
              const numEl = card.querySelector('.rank-card__num[data-target]')
              if (numEl) {
                const target = Number(numEl.getAttribute('data-target'))
                const decimals = Number(numEl.getAttribute('data-decimals') || '0')
                if (!Number.isNaN(target)) animateCount(numEl, target, decimals)
              }
            },
            prefersReducedMotion() ? 0 : i * 60,
          )
        })
        rankingsObserver?.disconnect()
        rankingsObserver = null
      },
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
    )

    rankingsObserver.observe(section)
  }

  function toggleRankings() {
    if (!rankingsSection || !btnRankings) return
    const show = rankingsSection.hasAttribute('hidden')
    if (show) {
      rankingsSection.removeAttribute('hidden')
      btnRankings.classList.add('is-active')
      btnRankings.setAttribute('aria-expanded', 'true')
      runRankingsAnimation()
      if (!prefersReducedMotion()) rankingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      rankingsSection.setAttribute('hidden', '')
      btnRankings.classList.remove('is-active')
      btnRankings.setAttribute('aria-expanded', 'false')
      if (rankingsObserver) {
        rankingsObserver.disconnect()
        rankingsObserver = null
      }
    }
  }

  function toggleAcademic() {
    if (!academicSection || !btnAcademic) return
    const show = academicSection.hasAttribute('hidden')
    if (show) {
      academicSection.removeAttribute('hidden')
      btnAcademic.classList.add('is-active')
      btnAcademic.setAttribute('aria-expanded', 'true')
      if (!prefersReducedMotion()) academicSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      academicSection.setAttribute('hidden', '')
      btnAcademic.classList.remove('is-active')
      btnAcademic.setAttribute('aria-expanded', 'false')
    }
  }

  if (btnRankings) {
    btnRankings.addEventListener('click', () => toggleRankings())
  }
  if (btnAcademic) {
    btnAcademic.addEventListener('click', () => toggleAcademic())
  }

  const degreeTabs = document.querySelector('.degree-tabs')
  if (degreeTabs) {
    degreeTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.degree-tabs__tab')
      if (!tab) return
      const deg = tab.getAttribute('data-degree')
      if (!deg) return

      degreeTabs.querySelectorAll('.degree-tabs__tab').forEach((t) => {
        const on = t === tab
        t.classList.toggle('is-active', on)
        t.setAttribute('aria-selected', String(on))
      })

      document.querySelectorAll('.degree-panel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.id === `degree-panel-${deg}`)
      })
    })
  }

  const cometLogin = document.getElementById('comet-login')
  const cometLauncher = document.getElementById('comet-launcher')
  const headerBottom = document.querySelector('.header-bottom')

  if (cometLogin instanceof HTMLAnchorElement && cometLauncher) {
    const custom = typeof cometLauncher.dataset.appHref === 'string' ? cometLauncher.dataset.appHref.trim() : ''
    if (custom) cometLogin.href = custom
  }

  if (cometLauncher instanceof HTMLElement && headerBottom instanceof HTMLElement) {
    let cometFabRaf = 0

    const readAudienceGapPx = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--comet-fab-audience-gap').trim()
      const n = Number.parseFloat(raw)
      return Number.isFinite(n) && n > 0 ? n : 26
    }

    const syncCometFabTop = () => {
      const gapPx = readAudienceGapPx()
      const bottom = headerBottom.getBoundingClientRect().bottom
      const belowHeaderPx = Math.round(bottom + gapPx)
      cometLauncher.style.removeProperty('top')
      cometLauncher.style.setProperty('--comet-fab-below-header', `${belowHeaderPx}px`)
    }

    const scheduleSyncCometFab = () => {
      if (cometFabRaf) return
      cometFabRaf = window.requestAnimationFrame(() => {
        cometFabRaf = 0
        syncCometFabTop()
      })
    }

    syncCometFabTop()
    window.addEventListener('scroll', scheduleSyncCometFab, { passive: true })
    window.addEventListener('resize', scheduleSyncCometFab)
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(scheduleSyncCometFab).observe(headerBottom)
    }
  }

  void (async function hydrateHeroSources() {
    const heroVideo = document.getElementById('hero-video')
    const heroSource = document.getElementById('hero-video-source')
    const campusSection = document.getElementById('campus-video')
    if (!heroVideo || !heroSource || !campusSection) return

    const customMp4 = campusSection.dataset?.heroMp4?.trim()
    if (customMp4) {
      heroSource.src = customMp4
      heroVideo.load()
      return
    }

    const headOk = async (href) => {
      try {
        const res = await fetch(href, { method: 'HEAD' })
        return res.ok
      } catch {
        return false
      }
    }

    const prependSource = (href) => {
      const s = document.createElement('source')
      s.src = href
      s.type = 'video/mp4'
      heroVideo.insertBefore(s, heroVideo.firstChild)
    }

    const downloadMp4 = new URL('/download.mp4', window.location.href).href
    const campusHeroMp4 = new URL('campus-hero.mp4', window.location.href).href

    if (await headOk(downloadMp4)) prependSource(downloadMp4)
    else if (await headOk(campusHeroMp4)) prependSource(campusHeroMp4)

    heroVideo.load()
  })()
})()
