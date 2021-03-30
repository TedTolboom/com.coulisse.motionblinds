function onHomeyReady(Homey) {
    var keyElement = document.getElementById('motion_key');
    var saveElement = document.getElementById('save');
    var clearElement = document.getElementById('clear');
  
    Homey.get('motion_key', function (err, motion_key) {
        if (err) return Homey.alert(err);
        keyElement.value = motion_key;
    });

    saveElement.addEventListener('click', function (e) {
        Homey.set('motion_key', keyElement.value, function (err) {
        if (err) return Homey.alert(err);
        });
    });
    
    clearElement.addEventListener('click', function (e) {
        keyElement.value = '';
        Homey.unset('motion_key', function (err) {
        if (err) return Homey.alert(err);
        });
    });

    Homey.ready();   
}