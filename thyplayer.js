/*
 * thyplayer v0.1.0
 * plugin to create circular audio player with visualization
 * https://github.com/sultantarimo
 *
 * (c)2015 Sultan Tarimo - sultantarimo@me.com
 * Released under the MIT license
 */
(function(){
    // safe debugging on production
    if (!window.console){
        window.console = {log: function(data) {return(data);}};
    }

    thyplayer = function(opts) {
        base = thyplayer.prototype;
        _this = this;

        // Defaults
        _this.opts                = {};
        _this.opts.iRadius        = opts.iRadius || 40+20;
        _this.opts.oRadius        = opts.oRadius || 60+20;
        _this.opts.barWidth       = opts.barWidth || 2.5;
        _this.opts.progBarWidth   = opts.progBarWidth || 6;
        _this.opts.density        = opts.density || 0.4;
        _this.opts.color          = opts.color || null;
        _this.opts.progBarColor   = opts.progBarColor || "#333";
        _this.opts.seekBarColor   = opts.seekBarColor || "red";
        _this.opts.node           = opts.node || "thyplayer";
        _this.opts.name           = opts.name || null;
        _this.opts.src            = opts.src || null;
        _this.opts.hideTime       = opts.hideTime || null;

        // nodes
        _this.$ = {
            base: function(){
                var $ = document.getElementsByClassName(_this.opts.node), elem = $[0];
                return{$: $,elem: elem};
            },
            canvas: function(){
                var $ = document.getElementsByClassName(_this.opts.node)[0].getElementsByTagName("canvas"), elem = $[0];
                var ctx = elem.getContext("2d");
                return{$: $,elem: elem,ctx:ctx};
            },
            play: function(){
                var $ = document.getElementsByClassName(_this.opts.node)[0].getElementsByTagName("a"), elem = $[0];
                return{$: $,elem: elem};
            },
            audio: function(){
                var $ = document.getElementsByClassName(_this.opts.node)[0].getElementsByTagName("audio"), elem = $[0];
                return{$: $,elem: elem, tag: "audio"};
            }
        };

        // data
        _this.data = {
            context: null,
            audio: null,
            analyser: null,
            source: {},
            cy: null,
            cx: null,
            divider: null,
            fftLength: null,
            angleStep: null,
            angle: null,
            line: null,
            radius: null,
            barHeight: null,
            src: null,
            time: null
        };

        // methodes
        _this.methodes = {
            cord: {
                getOffset: function(el) {
                    var _x = 0;
                    var _y = 0;
                    while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
                        _x += el.offsetLeft - el.scrollLeft;
                        _y += el.offsetTop - el.scrollTop;
                        el = el.offsetParent;
                    }
                    return { top: _y, left: _x };
                },
                getLine: function(cx, cy, angle, t, oRadius, iRadius) {
                  var radiusDiff = oRadius - iRadius,            // calc radius diff to get max length
                      length = radiusDiff * t;                   // now we have the line length
                  return {
                    x1: cx + oRadius * Math.cos(angle),             // x1 point (outer)
                    y1: cy + oRadius * Math.sin(angle),             // y1 point (outer)
                    x2: cx + (oRadius - length) * Math.cos(angle),  // x2 point (inner)
                    y2: cy + (oRadius - length) * Math.sin(angle)   // y2 point (inner)
                  };
                }
            },
            time: {
                current: function(){ return this.formate(_this.data.source.mediaElement.currentTime); },
                duration: function(){ return this.formate(_this.data.source.mediaElement.duration); },
                formate: function(time){
                    var minutes = Math.floor(time / 60);
                    var seconds = (time - minutes * 60).toFixed(0);
                    return {
                        raw: time,
                        formate: function(){
                            if(isNaN(minutes)){minutes = "0";}
                            if(isNaN(seconds)){seconds = "0";}

                            if(seconds < 10){seconds = "0"+seconds.toString();}
                            var timestamp = minutes + ":" + seconds;
                            return timestamp;
                        }
                    };
                },
                currentInRadians: function(){
                    var degrees = (this.current().raw/this.duration().raw) * 360;
                    var radians = degrees * (Math.PI/180);
                    return radians;
                },
                getTimeInRadians: function(data){
                    var degrees = (data/this.duration().raw) * 360;
                    var radians = degrees * (Math.PI/180);
                    return radians;
                },
                update: function(degrees){
                    degrees = Math.abs(degrees);
                    var degToTime = _this.methodes.time.duration().raw;
                    if(degToTime > 100000 || !degToTime){return false;}

                        degToTime = (Math.abs(degrees)/360) * degToTime;
                        degToTime = degToTime;

                    _this.data.source.mediaElement.currentTime = degToTime;
                    _this.data.time = degToTime;
                },
                addText: function(){
                    var $time = _this.$.base().elem.querySelector("p");
                        $time.textContent = _this.methodes.time.current().formate() + " : " + _this.methodes.time.duration().formate();

                    var $name = _this.$.base().elem.querySelector("h1");
                        $name.innerHTML = _this.opts.name;

                    if(!_this.opts.name){
                        $name.className = "hide";
                    }
                    if(_this.opts.hideTime === true){
                        $time.className = "hide";
                    }
                },
                updateTime: function(e){
                    // get mouse x/y
                    var r = _this.$.canvas().elem.getBoundingClientRect(),
                        mx = e.clientX - r.left,
                        my = e.clientY - r.top;

                    // get diff. between mouse and circle center
                    var dx = mx - _this.data.cx,
                        dy = my - _this.data.cy;

                    var angle = Math.atan2(dy, dx),
                        degrees = angle * (180/Math.PI);
                        degrees = (degrees + 360+90) % 360;

                    _this.methodes.time.update(degrees);
                    if(_this.data.source.mediaElement){_this.methodes.time.update(degrees);}
                }
            },
            canvas: {
                init: function(){
                    if(_this.opts.src){_this.data.src = _this.opts.src;}

                    _this.data.audio = new Audio();
                    _this.data.audio.src = _this.data.src;
                    _this.data.audio.controls = true;
                    _this.data.audio.loop = false;
                    _this.data.audio.autoplay = false;

                    _this.$.base().elem.appendChild(_this.data.audio);

                    window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
                    _this.data.context = new AudioContext(); // AudioContext object instance
                    analyser = _this.data.context.createAnalyser(); // AnalyserNode method
                    // Re-route audio playback into the processing graph of the AudioContext
                    _this.data.source = _this.data.context.createMediaElementSource(_this.data.audio);

                    _this.data.source.connect(analyser);
                    analyser.connect(_this.data.context.destination);

                    _this.data.source.mediaElement = document.getElementsByClassName(_this.opts.node)[0].getElementsByTagName(_this.$.audio().tag)[0];

                    _this.events.onPlayClick();
                    _this.events.onPlayEnd();
                    _this.methodes.canvas.frameLooper();
                },
                frameLooper: function(){
                    window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
                    window.requestAnimationFrame(_this.methodes.canvas.frameLooper);

                    _this.data.fbc_array = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(_this.data.fbc_array);
                        _this.methodes.time.addText();
                        _this.methodes.canvas.drawCircle(_this.opts);
                },
                drawCircle: function(data){
                    // calculate number of steps based on bars
                    width = _this.$.canvas().elem.width = _this.$.canvas().elem.width,
                    height = _this.$.canvas().elem.height = _this.$.canvas().elem.width,

                    _this.data.cx = _this.$.canvas().elem.width/2,
                    _this.data.cy = _this.$.canvas().elem.height/2,

                    _this.data.divider = 16*data.density,
                    // Safari: no audioprocess event or byte frequency data, https://bugs.webkit.org/show_bug.cgi?id=125031
                    _this.data.fftLength = _this.data.fbc_array.length/_this.data.divider,
                    _this.data.angleStep = Math.PI * 2 / _this.data.fftLength,

                    _this.data.angle = 0,
                    _this.data.line;

                    _this.$.canvas().ctx.beginPath();

                    // radius of ring
                    var radius = {
                        inner: width/3.2,
                        outer: width/3,
                        cx: function(){ return width/2; },
                        cy: function(){ return height/2; }
                    };

                    for(var i = 0; i < _this.data.fftLength; i += 1) {
                        // position bars
                        _this.data.barHeight = -(_this.data.fbc_array[i] / 2)/(width/20);
                        _this.data.line = _this.methodes.cord.getLine(radius.cx(), radius.cy(), _this.data.angle, _this.data.barHeight, radius.outer, radius.inner);

                        _this.$.canvas().ctx.moveTo(_this.data.line.x1, _this.data.line.y1);// add line to path
                        _this.$.canvas().ctx.lineTo(_this.data.line.x2, _this.data.line.y2);
                        _this.data.angle += _this.data.angleStep;// get next angle
                    }

                    // draw bars
                    _this.$.canvas().ctx.lineWidth = data.barWidth;// beware of center area
                    _this.$.canvas().ctx.strokeStyle = data.color;
                    if(_this.data.gradient){_this.$.canvas().ctx.strokeStyle = _this.data.gradient;}
                    _this.$.canvas().ctx.stroke();// stroke all lines at once

                    // draw base static circle
                    _this.$.canvas().ctx.beginPath();

                    _this.$.canvas().ctx.lineWidth = data.progBarWidth/6;
                    _this.$.canvas().ctx.strokeStyle = data.seekBarColor;
                    if(_this.data.gradient){_this.$.canvas().ctx.strokeStyle = _this.data.gradient;}

                    _this.data.deg90toRad = 1.5 * Math.PI;
                    _this.$.canvas().ctx.arc(radius.cx(), radius.cy(), radius.outer-data.progBarWidth+0.5, _this.data.deg90toRad, 1.499*Math.PI );
                    _this.$.canvas().ctx.stroke();

                    var buffered = _this.data.source.mediaElement.buffered;
                    if(buffered.length > 0){
                        for (i = 0; i < buffered.length; i++) {
                            var bufferedTimeRads = {
                                start: _this.methodes.time.getTimeInRadians(buffered.start(i)),
                                end: _this.methodes.time.getTimeInRadians(buffered.end(i))
                            };

                            _this.$.canvas().ctx.beginPath();
                            _this.$.canvas().ctx.lineWidth = data.progBarWidth;
                            _this.$.canvas().ctx.strokeStyle = "rgba(239,239,239,0.7)";

                            _this.$.canvas().ctx.arc(radius.cx(), radius.cy(), radius.outer-data.progBarWidth+0.5, bufferedTimeRads.end+(_this.data.deg90toRad), bufferedTimeRads.start+_this.data.deg90toRad );
                            _this.$.canvas().ctx.stroke();
                        }
                    }

                    // draw progress meter
                    _this.$.canvas().ctx.beginPath();
                    _this.$.canvas().ctx.lineWidth = data.progBarWidth;
                    _this.$.canvas().ctx.strokeStyle = data.progBarColor;

                    _this.data.deg90toRad = 1.5 * Math.PI;
                    _this.$.canvas().ctx.arc(radius.cx(), radius.cy(), radius.outer-data.progBarWidth, _this.data.deg90toRad, _this.methodes.time.currentInRadians()+(_this.data.deg90toRad) );
                    _this.$.canvas().ctx.stroke();
                }
            }
        };

        // events
        _this.events = {
            onPlayClick: function(){
                _this.$.play().elem.addEventListener("mouseup", function(){
                    if(_this.data.source.mediaElement.paused === true){
                        _this.data.source.mediaElement.play();
                        this.className = 'playing';
                    }else{
                        _this.data.source.mediaElement.pause();
                        this.className = "paused";
                    }
                });
            },
            onPlayEnd: function(){
                _this.data.source.mediaElement.addEventListener('ended', function(){
                    _this.methodes.time.update(0);
                    _this.$.play().elem.className = "stopped";
                });
            },
            onDragStart: function(e){
                _this.methodes.time.updateTime(e);
            },
            onDragMove: function(e){
                _this.methodes.time.updateTime(e);
            },
            onVolumeChange: function(data, e){
                _this.data.source.mediaElement.volume = parseInt(data.value)/100;
                // Firefox ignores volume all together, strange.
            }
        };

        // initializer
        _this.main = function(){
            _this.$.base().elem.appendChild(document.createElement("h1")); // add name
            _this.$.base().elem.appendChild(document.createElement("p")); // add time

            var div = document.createElement("div");
                div.className = "canvas";
            _this.$.base().elem.appendChild(div);

            _this.$.base().elem.getElementsByClassName("canvas")[0].appendChild(document.createElement("a")); // add play
            _this.$.base().elem.getElementsByClassName("canvas")[0].appendChild(document.createElement("canvas")); // add canvas

            var vol = document.createElement("input");
                vol.className = "volume";
                vol.setAttribute("type", "range");
            _this.$.base().elem.appendChild(vol);

            // Up, up and away
            _this.methodes.canvas.init();

            // Lets attach events
            _this.events.onVolumeChange(vol);

            _this.$.canvas().elem.onmousedown = function(e) {
                _this.events.onDragStart(e);
                _this.$.canvas().elem.onmousemove = function(e) {_this.events.onDragMove(e);};
                // Firefox does seem to work well with seeking, TODO: find a work around.
            };

            _this.$.canvas().elem.onmouseup = function(e) {
                _this.$.canvas().elem.onmousemove = null;
            };

            vol.addEventListener("input", function(e){
                _this.events.onVolumeChange(this, e);
            });

            // Defaults to gradient if color not specified.
            if(!_this.opts.color){
                var gradient = _this.$.canvas().ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(1, 'red');
                gradient.addColorStop(0, '#F7C100');
                _this.data.gradient = gradient;
            }
        }();

        _this.update = function(){
            _this.methodes.time.addText();
            _this.methodes.canvas.drawCircle(_this.opts);
        };
    };

})();

