;(function(){
  'use strict'

  // Elements
  const levelPercentEl = document.getElementById('levelPercent')
  const motorStateBadge = document.getElementById('motorStateBadge')
  const modeText = document.getElementById('modeText')
  const progressBar = document.getElementById('progressBar')
  const waterFill = document.getElementById('waterFill')
  const modeToggle = document.getElementById('modeToggle')
  const motorToggle = document.getElementById('motorToggle')
  const motorToggleText = document.getElementById('motorToggleText')
  const motorIcon = document.getElementById('motorIcon')
  const minThreshold = document.getElementById('minThreshold')
  const maxThreshold = document.getElementById('maxThreshold')
  const minOutput = document.getElementById('minOutput')
  const maxOutput = document.getElementById('maxOutput')
  const logList = document.getElementById('logList')
  const clearLogBtn = document.getElementById('clearLog')
  const themeToggle = document.getElementById('themeToggle')
  const resetSettings = document.getElementById('resetSettings')
  const yearSpan = document.getElementById('yearSpan')

  yearSpan.textContent = new Date().getFullYear()

  // State
  const state = {
    levelPercent: null, // Remove initial value; will be fetched from Blynk
    isAuto: true,
    motorOn: false,
    minLevel: 30,
    maxLevel: 85,
    theme: 'dark'
  };

  // Persistence
  const STORAGE_KEY = 'smart-tank-settings-v1'
  function save(){
    const {isAuto, minLevel, maxLevel, theme} = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({isAuto, minLevel, maxLevel, theme}))
  }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY)
      if(!raw) return
      const obj = JSON.parse(raw)
      Object.assign(state, obj)
    }catch(err){/* ignore */}
  }

  load()

  // Apply loaded values to UI
  function initUI(){
    modeToggle.checked = state.isAuto
    modeText.textContent = state.isAuto ? 'AUTO' : 'MANUAL'
    minThreshold.value = state.minLevel
    maxThreshold.value = state.maxLevel
    minOutput.textContent = `${state.minLevel}%`
    maxOutput.textContent = `${state.maxLevel}%`
    setTheme(state.theme)
    updateMotorControls()
    render()
  }

  // Theme
  function setTheme(theme){
    state.theme = theme
    document.documentElement.classList.toggle('is-light', theme === 'light')
    themeToggle.textContent = theme === 'light' ? '🌙' : '🌓'
    save()
  }

  themeToggle.addEventListener('click', ()=>{
    setTheme(state.theme === 'light' ? 'dark' : 'light')
  })

  resetSettings.addEventListener('click', ()=>{
    Object.assign(state, {isAuto:true,minLevel:30,maxLevel:85,theme:'dark'})
    save(); initUI(); log('Settings reset', 'info')
  })

  // Logging
  function log(message, type){
    const li = document.createElement('li')
    const time = new Date().toLocaleTimeString()
    li.innerHTML = `<span class="log__time">${time}</span> <span class="log__badge">${type||'event'}</span> <span>${message}</span>`
    logList.prepend(li)
  }
  clearLogBtn.addEventListener('click', ()=>{ logList.innerHTML = '' })

  // Render
  function render(){
    if (state.levelPercent !== null) {
      levelPercentEl.textContent = `${state.levelPercent}%`;
      progressBar.style.width = `${state.levelPercent}%`;
      waterFill.style.transform = `translateY(${100 - state.levelPercent}%)`;
    } else {
      levelPercentEl.textContent = 'Fetching...'; // Display placeholder while fetching
      progressBar.style.width = '0%';
      waterFill.style.transform = `translateY(100%)`;
    }

    motorStateBadge.textContent = state.motorOn ? 'ON' : 'OFF'
    motorStateBadge.className = `badge ${state.motorOn ? 'badge--on':'badge--off'}`
  }

  function updateMotorControls() {
    const manual = !state.isAuto;
    motorToggle.disabled = !manual; // Enable toggle only in manual mode
    motorToggle.classList.toggle('motor-on', state.motorOn && manual);
    motorIcon.textContent = state.motorOn ? '⏹' : '▶';
    motorToggleText.textContent = state.motorOn ? 'Stop Motor' : 'Start Motor';
    modeText.textContent = state.isAuto ? 'AUTO' : 'MANUAL';
  }

  function clamp(n,min,max){return Math.min(max, Math.max(min,n))}

  // Controls events
  modeToggle.addEventListener('change', (e) => {
    state.isAuto = e.target.checked;
    updateMotorControls();
    save();
    log(`Mode changed to ${state.isAuto ? 'AUTO' : 'MANUAL'}`, 'mode');
  })

  motorToggle.addEventListener('click', () => {
    if (state.isAuto) return; // Prevent manual control if in auto mode

    // Toggle motor state
    state.motorOn = !state.motorOn;

    // Update UI
    updateMotorControls();

    // Log the action
    log(`Motor ${state.motorOn ? 'started' : 'stopped'} (manual)`, 'motor');

    // Send updated motor state to Blynk
    updateBlynkMotorState(state.motorOn);
  })

  // Simulation loop
  const TICK_MS = 800
  let timer = null
  function tick() {
    // Auto logic with hysteresis
    if (state.isAuto) {
      if (!state.motorOn && state.levelPercent <= state.minLevel) {
        state.motorOn = true;
        log(`Auto ON at ${state.levelPercent.toFixed(0)}%`, 'auto');
      } else if (state.motorOn && state.levelPercent >= state.maxLevel) {
        state.motorOn = false;
        log(`Auto OFF at ${state.levelPercent.toFixed(0)}%`, 'auto');
      }
      updateMotorControls();
    }

    render();
  }

  function start(){
    if(timer) return
    timer = setInterval(tick, TICK_MS)
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null } }

  // Visibility handling
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ stop() } else { start() }
  })

  // Blynk Configuration
  const BLYNK_AUTH_TOKEN = 'YOUR_BLYNK_AUTH_TOKEN'; // Replace with your Blynk Auth Token
  const BLYNK_API_URL = `https://blynk.cloud/external/api`;

  // Function to send motor state to Blynk
  function updateBlynkMotorState(state) {
    const motorState = state ? 1 : 0; // 1 for ON, 0 for OFF
    fetch(`${BLYNK_API_URL}/update?token=${BLYNK_AUTH_TOKEN}&v1=${motorState}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update motor state on Blynk');
        }
        console.log(`Motor state updated on Blynk: ${state ? 'ON' : 'OFF'}`); // Log Blynk status in console
        log(`Motor state updated on Blynk: ${state ? 'ON' : 'OFF'}`, 'blynk');
      })
      .catch(err => console.error('Error updating motor state on Blynk:', err));
  }

  // Function to fetch motor state from Blynk
  function fetchBlynkMotorState() {
    fetch(`${BLYNK_API_URL}/get?token=${BLYNK_AUTH_TOKEN}&v1`)
      .then(response => response.json())
      .then(data => {
        const motorState = data[0] === '1'; // Convert Blynk response to boolean
        state.motorOn = motorState;
        updateMotorControls();
        render();
        console.log(`Motor state fetched from Blynk: ${motorState ? 'ON' : 'OFF'}`); // Log Blynk status in console
        log(`Motor state fetched from Blynk: ${motorState ? 'ON' : 'OFF'}`, 'blynk');
      })
      .catch(err => console.error('Error fetching motor state from Blynk:', err));
  }

  // Function to fetch tank level from Blynk
  function fetchBlynkTankLevel() {
    fetch(`${BLYNK_API_URL}/get?token=${BLYNK_AUTH_TOKEN}&v2`) // Replace `v2` with the virtual pin for tank level
      .then(response => response.json())
      .then(data => {
        const tankLevel = parseFloat(data[0]); // Convert Blynk response to a number
        state.levelPercent = clamp(tankLevel, 0, 100); // Update the state with the fetched tank level
        render(); // Re-render the UI with the updated tank level
        console.log(`Tank level fetched from Blynk: ${tankLevel}%`); // Log Blynk status in console
      })
      .catch(err => console.error('Error fetching tank level from Blynk:', err));
  }

  // Periodically fetch tank level from Blynk
  setInterval(fetchBlynkTankLevel, 5000); // Fetch every 5 seconds

  // Fetch motor state from Blynk on initialization
  fetchBlynkMotorState();

  // Initialize
  initUI()
  start()
  log('System initialized','info')
})()


