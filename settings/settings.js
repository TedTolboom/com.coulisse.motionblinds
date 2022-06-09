// Support for MOTION Blinds by Coulisse, by Edwin Delsman

function onHomeyReady(Homey) {
    var keyElement = document.getElementById('motion_key');
    var ipElement = document.getElementById('motion_ip');
    var debugElement = document.getElementById('debug');
    var multicastElement = document.getElementById('multicast');
    var multisocketElement = document.getElementById('multisocket');
    var clearElement = document.getElementById('clear');
    var saveElement = document.getElementById('save');
  
    Homey.get('motion_key', function (err, motion_key) {
        if (err) return Homey.alert(err);
        keyElement.value = motion_key;
    });

    Homey.get('motion_ip', function (err, motion_ip) {
        if (err) return Homey.alert(err);
        ipElement.value = motion_ip;
    });

    Homey.get('debug', function (err, debug) {
        if (err) return Homey.alert(err);
        debugElement.checked = debug;
    });

    Homey.get('multicast', function (err, multicast) {
        if (err) return Homey.alert(err);
        multicastElement.checked = multicast;
    });

    Homey.get('multisocket', function (err, multisocket) {
        if (err) return Homey.alert(err);
        multisocketElement.checked = multisocket;
    });

    saveElement.addEventListener('click', function (e) {
        Homey.set('motion_key', keyElement.value, function (err) {
            if (err) return Homey.alert(err);
        });
        Homey.set('motion_ip', ipElement.value, function (err) {
            if (err) return Homey.alert(err);
        });
        Homey.set('debug', debugElement.checked, function (err) {
            if (err) return Homey.alert(err);
            });
        Homey.set('multicast', multicastElement.checked, function (err) {
            if (err) return Homey.alert(err);
            });
        Homey.set('multisocket', multisocketElement.checked, function (err) {
            if (err) return Homey.alert(err);
            });
        });
    
    clearElement.addEventListener('click', function (e) {
        keyElement.value = '';
        Homey.unset('motion_key', function (err) {
            if (err) return Homey.alert(err);
        });
        ipElement.value = '';
        Homey.unset('motion_ip', function (err) {
            if (err) return Homey.alert(err);
        });
        debugElement.checked = false;
        Homey.unset('debug', function (err) {
            if (err) return Homey.alert(err);
        });
        debugElement.multicast = false;
        Homey.unset('multicast', function (err) {
            if (err) return Homey.alert(err);
        });
        debugElement.multisocket = false;
        Homey.unset('multisocket', function (err) {
            if (err) return Homey.alert(err);
        });
    });

    Homey.ready();   
}