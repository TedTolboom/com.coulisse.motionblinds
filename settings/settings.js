// Support for MOTION Blinds by Coulisse, by Edwin Delsman

function onHomeyReady(Homey) {
    var keyElement = document.getElementById('motion_key');
    var debugElement = document.getElementById('debug');
    var multicastElement = document.getElementById('multicast');
    var clearElement = document.getElementById('clear');
    var saveElement = document.getElementById('save');
  
    Homey.get('motion_key', function (err, motion_key) {
        if (err) return Homey.alert(err);
        keyElement.value = motion_key;
    });

    Homey.get('debug', function (err, debug) {
        if (err) return Homey.alert(err);
        debugElement.checked = debug;
    });

    Homey.get('multicast', function (err, multicast) {
        if (err) return Homey.alert(err);
        multicastElement.checked = multicast;
    });

    saveElement.addEventListener('click', function (e) {
        Homey.set('motion_key', keyElement.value, function (err) {
            if (err) return Homey.alert(err);
        });
        Homey.set('debug', debugElement.checked, function (err) {
            if (err) return Homey.alert(err);
            });
        Homey.set('multicast', multicastElement.checked, function (err) {
            if (err) return Homey.alert(err);
            });
        });
    
    clearElement.addEventListener('click', function (e) {
        keyElement.value = '';
        Homey.unset('motion_key', function (err) {
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
    });

    Homey.ready();   
}