(function(){
  // Mobile nav
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', function(){
    var isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });
  mainNav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ mainNav.classList.remove('open'); navToggle.setAttribute('aria-expanded','false'); });
  });

  // Coordinate guide modal
  var coordModal = document.getElementById('coordModal');
  function openModal(){ coordModal.classList.add('open'); }
  function closeModal(){ coordModal.classList.remove('open'); }
  document.getElementById('openCoordGuide').addEventListener('click', openModal);
  document.getElementById('copyGuideBtn').addEventListener('click', openModal);
  document.getElementById('closeCoordGuide').addEventListener('click', closeModal);
  coordModal.addEventListener('click', function(e){ if(e.target === coordModal) closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  // Use my location
  document.getElementById('useMyLocation').addEventListener('click', function(){
    var input = document.getElementById('pickupCoord');
    var btn = this;
    if(!navigator.geolocation){ alert('Perangkat ini tidak mendukung deteksi lokasi otomatis. Silakan salin koordinat dari peta secara manual.'); return; }
    btn.textContent = '⏳ Mencari…';
    navigator.geolocation.getCurrentPosition(function(pos){
      input.value = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
      btn.textContent = '📍 Lokasi Saya';
      input.closest('.field').classList.remove('has-error');
    }, function(){
      btn.textContent = '📍 Lokasi Saya';
      alert('Lokasi tidak dapat diakses. Pastikan izin lokasi diaktifkan, atau salin koordinat manual dari peta.');
    });
  });

  // Coordinate validation
  var coordPattern = /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/;
  function validCoord(val){
    if(!coordPattern.test(val.trim())) return false;
    var parts = val.split(',').map(function(s){ return parseFloat(s.trim()); });
    return Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180;
  }

  // In-memory order store (session only — no browser storage)
  var orders = [];
  var pendingOrder = null;

  function genCode(){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = 'ELG-';
    for(var i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }
  function genPin(){ return String(Math.floor(1000 + Math.random()*9000)); }

  var orderForm = document.getElementById('orderForm');
  orderForm.addEventListener('submit', function(e){
    e.preventDefault();
    var pickupField = document.getElementById('pickupCoord').closest('.field');
    var dropoffField = document.getElementById('dropoffCoord').closest('.field');
    var pickupVal = document.getElementById('pickupCoord').value;
    var dropoffVal = document.getElementById('dropoffCoord').value;
    var ok = true;

    if(!validCoord(pickupVal)){ pickupField.classList.add('has-error'); ok = false; } else { pickupField.classList.remove('has-error'); }
    if(!validCoord(dropoffVal)){ dropoffField.classList.add('has-error'); ok = false; } else { dropoffField.classList.remove('has-error'); }
    if(!document.getElementById('senderName').value.trim() || !document.getElementById('senderPhone').value.trim() ||
       !document.getElementById('receiverName').value.trim() || !document.getElementById('receiverPhone').value.trim()){
      ok = false;
      alert('Lengkapi dulu data pengirim dan penerima ya.');
    }
    if(!ok) return;

    var order = {
      code: genCode(),
      pin: genPin(),
      pickup: pickupVal.trim(),
      dropoff: dropoffVal.trim(),
      itemType: document.getElementById('itemType').value.trim() || 'Barang umum',
      createdAt: Date.now()
    };

    // simple distance-based fee estimate (haversine)
    function toRad(d){ return d * Math.PI / 180; }
    function haversineKm(a, b){
      var R = 6371;
      var dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
      var x = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)*Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    }
    var pParts = pickupVal.split(',').map(function(s){ return parseFloat(s.trim()); });
    var dParts = dropoffVal.split(',').map(function(s){ return parseFloat(s.trim()); });
    var km = haversineKm(pParts, dParts);
    var fee = Math.round((8000 + km*3000) / 500) * 500;
    order.fee = fee;

    pendingOrder = order;
    document.getElementById('payOrderCode').textContent = order.code;
    document.getElementById('payAmount').textContent = 'Rp ' + fee.toLocaleString('id-ID');
    openPaymentModal();
  });

  function openPaymentModal(){ document.getElementById('paymentModal').classList.add('open'); }
  function closePaymentModal(){ document.getElementById('paymentModal').classList.remove('open'); }
  document.getElementById('closePayment').addEventListener('click', closePaymentModal);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePaymentModal(); });

  // payment tabs
  document.querySelectorAll('.pay-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.pay-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var isTransfer = tab.dataset.tab === 'transfer';
      document.getElementById('panelTransfer').style.display = isTransfer ? 'block' : 'none';
      document.getElementById('panelQris').style.display = isTransfer ? 'none' : 'block';
    });
  });

  // confirm payment (simulation) -> proceed to confirmation card
  document.getElementById('confirmPayBtn').addEventListener('click', function(){
    if(!pendingOrder) return;
    orders.push(pendingOrder);
    closePaymentModal();
    document.getElementById('outCode').textContent = pendingOrder.code;
    document.getElementById('outPin').textContent = pendingOrder.pin;
    document.getElementById('confirmCard').classList.add('open');
    document.getElementById('confirmCard').scrollIntoView({behavior:'smooth', block:'center'});
    orderForm.reset();
    pendingOrder = null;
  });

  // Tracking
  var stageDefs = [
    {label:'Pesanan diterima', mins:0},
    {label:'AI menghitung rute penerbangan', mins:0.15},
    {label:'Drone lepas landas', mins:0.35},
    {label:'Dalam perjalanan menuju titik tujuan', mins:0.6},
    {label:'Barang mendarat di tujuan', mins:0.85}
  ];

  document.getElementById('trackForm').addEventListener('submit', function(e){
    e.preventDefault();
    var code = document.getElementById('trackCode').value.trim().toUpperCase();
    var pin = document.getElementById('trackPin').value.trim();
    var found = orders.find(function(o){ return o.code === code && o.pin === pin; });

    var resultEl = document.getElementById('trackResult');
    var emptyEl = document.getElementById('trackEmpty');

    if(!found){
      resultEl.classList.remove('open');
      emptyEl.classList.add('open');
      return;
    }
    emptyEl.classList.remove('open');

    var elapsedMin = (Date.now() - found.createdAt) / 60000;
    var reachedIndex = 0;
    stageDefs.forEach(function(s, i){ if(elapsedMin >= s.mins) reachedIndex = i; });

    document.getElementById('trackResultCode').textContent = found.code;
    document.getElementById('trackResultStatus').textContent = stageDefs[reachedIndex].label;
    document.getElementById('trackResultItem').textContent = found.itemType;

    var timelineEl = document.getElementById('trackTimeline');
    timelineEl.innerHTML = '';
    stageDefs.forEach(function(s, i){
      var li = document.createElement('li');
      li.className = i <= reachedIndex ? 'done' : '';
      li.innerHTML = '<span class="dot"></span><span class="t">' + s.label + '</span>';
      timelineEl.appendChild(li);
    });

    resultEl.classList.add('open');
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function(item){
    item.querySelector('.faq-q').addEventListener('click', function(){
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function(i){ i.classList.remove('open'); });
      if(!wasOpen) item.classList.add('open');
    });
  });
})();
