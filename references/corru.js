//removes nasty html extension from the URL which could interfere with stuff
if(location.pathname.includes("/index.html")) location.replace(location.pathname.replace('/index.html', '/'))

//basic global stuff
//shortcuts
var content = document.querySelector('#content')
var body = document.body

//flags - story progress, save, etc
var flags = { dialogues: {}, dullvessel_position: 'orbit', detectedEntities: {}}
if(localStorage.getItem('flags') && localStorage.getItem('flags') != "null") {
    flags = JSON.parse(localStorage.getItem('flags'))
}

//local environment
var env = {
    corruStaticBaseVol: 0.4, //base transition volume
    mui: false, //determines whether the mindspike UI is on or not
    dialogues: {}, //dialogues and actors are added to per-page, as needed
    entities: {}, //ditto
    definitions: {}, //used by the dialogue/readoutAdd system to process strings and add hover definitions to words automatically. works same as above objects
    cursor: {x:0, y:0}, //fixed coords
    pageCursor: {x:0, y:0}, //page coords
    targeted: [], //used by MUI to cycle targets
    bgm: null,
    dialogueActors: {
        sourceless: {
            type: "sourceless",
        },

        "sourceless quiet": {
            name: "sourceless",
            type: "sourceless",
            voice: false
        },

        "combat": {
            name: "combat",
            type: "combat-message",
            noProcess: true,
        },

        "sourceless incoherent": {
            name: "sourceless",
            type: "sourceless incoherent",
        },
    
        moth: {
            image: '/img/sprites/moth/mothman.gif',
            type: "external moth",
            noProcess: true,
        }, 
    
        unknown: {
            image: '/img/sprites/velzie/smile2.png',
            type: "velzie",
            element: "#velzieface",
            noProcess: true,
            voice: ()=>{play('talksignal', 0.5)}
        },
    
        self: {
            image: '/img/portraits/interloper.gif',
            type: "interloper",
            noProcess: true,
            player: true
        },
    
        sys: {
            image: '/img/mui/mindspikelogoactive.gif',
            type: "mindspike",
            player: true,
            noProcess: true,
            voice: ()=>{play('muiScanner', 2)}
        },

        funfriend: {
            element: "#funfriend",
            image: '/img/sprites/funfriend/funfriend.gif',
            type: "obesk funfriend",
            voice: ()=>{play('talk', 2)}
        },

        proxyfriend: {
            element: "#ffproxy",
            image: '/img/sprites/funfriend/proxyfriend.gif',
            type: "obesk funfriend",
            voice: ()=>{play('talkhigh', 1)}
        },

        akizet: {
            image: '/img/sprites/akizet/portrait.gif',
            type: "obesk qou akizet",
            element: ".truecreature .akizet",
            player: true,
            voice: ()=>play('talk', 2.5)
        },

        bstrd: {
            image: '/img/sprites/bstrd/bstrd.gif',
            type: "bstrd portrait-cover",
            voice: ()=>play('talkgal', 0.4)
        },
    
        actual_site_error: {
            noProcess: true,
            image: '/img/viendbot.png',
            type: "metafiend portrait-dark portrait-contain",
            voice: ()=>{play('muiClick', 2)}
        },

        bugviend: {
            name: 'Â»ÃµGQÃ Âº3Â¾Ãµâ€cR%',
            type: "incoherent thoughtform portrait-blocker hallucination",
            image: "/img/sprites/combat/foes/hallucinations/portrait.gif",
            voice: ()=>play('fear', 2)
        },

        effigy: {
            image: '/img/local/uncosm/ozo/akieffigy_portrait.gif',
            type: "thoughtform awakened portrait-haze portrait-cover",
            element: "#realgrid .akieffigy",
            voice: ()=>play('talkflower', 1.25)
        },

        bugout: {
            image: "/img/sprites/daemons/knight/scan.gif",
            type: "bstrd uppercase portrait-contain",
            voice: ()=>play('talkcroak', 0.6)
        }
    },
    totalMessages: 0,

    stage: { //stage stuff - mostly defined per page
        locales: {} // reference of sprites per tile for floor canvasing
    }, 
    stages: {}, //individual stage references
    stageEntities: {
        '.': {slug: '.', class: "blocks nothing"},
        "â–‘": {slug: 'â–‘', class: "empty plain"}, //generic movable space
        
        p: { //player spawn point
            class: "empty plain",
            contains: {
                slug: 'p',
                id: "creature",
                class: "player ally-sprite",
                type: "player"
            }
        }
    },
		
    timeouts: [],
    setTimeout: (func, time) => {
        let newTimeout = setTimeout(func, time)
        env.timeouts.push(newTimeout)
        return newTimeout
    },
    clearTimeouts: ()=>{
        env.timeouts.forEach(timeout => {
            clearTimeout(timeout)
        });
    },
		
    intervals: [],
    setInterval: (func, time) => {
        let newInterval = setInterval(func, time)
        env.intervals.push(newInterval)
        return newInterval
    },
    clearIntervals: ()=>{
        env.intervals.forEach(interval => {
            clearInterval(interval)
        });
    },

    //local storage of the last x readout log things
    logStore: [],

    //document-based corru events for modding mostly
    hooks: {
        /*  triggered at the end of each respective event in the page lifecycle
            
            usage i.e. 
                //this is called before corru_entered on pages with no "enter" screen, or otherwise when the enter button is made visible
                //it doesn't necessarily mean everything is loaded, more like the DOM is ready to proceed
                document.addEventListener('corru_loaded', ()=>{
                    console.log(`${page.title} on-load events complete`)
                })

                //resource additions are used to load critical JS files and stop entering until they're done
                //this is presently distinct from loaded, in that only certain pages use it (ozo and embassy pages) in order to load extra stuff
                //you'll want to use this if you want to wait for dialogues to be initialized on those pages
                //sorry that it's separate from corru_loaded LOL i know that sucks - need to overhaul some stuff to make it be one singular thing though
                document.addEventListener('corru_resources_added', (ev)=>{
                    const arrayOfStringURLsLoaded = ev.detail.resList
                    console.log(`${page.title}'s instance of addResources completed`, arrayOfStringURLsLoaded)
                })

                document.addEventListener('corru_entered', ()=>{
                    console.log(`now entering ${page.title}`)
                })

                document.addEventListener('corru_leaving', ()=>{
                    console.log(`now leaving ${page.title}`)
                })

                document.addEventListener('corru_changed', (ev)=>{
                    const key = ev.detail.key;
                    const value = ev.detail.value;
                })

                document.addEventListener('corru_act', (ev)=>{
                    const entity = ev.detail.entity; //what's being acted upon
                    const action = ev.detail.action; //the action
                })

                document.addEventListener('corru_net', (ev)=>{
                    // do you hear it too?
                })

                document.addEventListener('stage_change', (ev)=>{
                    const stageName = ev.detail.stage; //stage changed to
                })

            can be manually triggered via dispatchEvent, i.e. "document.dispatchEvent(env.hooks.corru_loaded)" 

            the page object is updated periodically, so if you need to preserve it, be sure you do something like 'let currentPage = page' so you have the ref
            here are some useful props
                path: the URL path (i.e. /hub/)
                title: what appears in the browser tab and log when navigating
                name: the title in a short 'slugified' version, (..__LOCALHOST__.. => localhost)
                dialoguePrefix: prefix for dialogue flags that are checked on this page, ("hub" marks flags like so: "hub__funfriend-start")

                ( plus some others not listed since they shouldn't be touched so they aren't listed here sry :-P )
                    P.S. don't modify the page-specific page.flags object directly
                    instead, set via the PAGE!! prefix in change(), i.e. change("PAGE!!somethingOnThisPage", true)
        */

        corru_loaded: new CustomEvent('corru_loaded'), 
        corru_entered: new CustomEvent('corru_entered'),
        corru_resources_added: new CustomEvent('corru_resources_added'),
        corru_leaving: new CustomEvent('corru_leaving'),
        corru_changed: new CustomEvent('corru_changed'),
        corru_net: new CustomEvent('corru_net'),
        corru_act: new CustomEvent('corru_act'),
        stage_change: new CustomEvent('stage_change'),
    },

    masks: { 
        reality: {
            sound: "realitymask",
            on: ()=>{},
            off: ()=>{},
            maskImage: `url(/img/portraits/interloper.gif)`,
            definition: "'no effect'"
        },

        unity: {
            sound: "unitymask",
            on: ()=>{}, //class based
            off: ()=>{},
            maskImage: `url(/img/mui/mask/unity.gif), url(/img/textures/dithertran.gif), url(/img/textures/memoryhaze.gif)`,
            showIf: "ozo__council-task",
            definition: () => `'enables additional ACT on responsive thoughtforms'${page.maskUnityNote ? page.maskUnityNote : ''}`
        },

        hunger: {
            sound: "hungermask",
            on: ()=>{ env.fakenet = -2; updateCode() },
            off: ()=>{ env.fakenet = false; updateCode() },
            maskImage: `url(/img/mui/mask/hunger.gif), url(/img/textures/spotgradientinversewhitetiny.gif), url(/img/textures/memoryhaze.gif)`,
            showIf: "ozo__fairy_intro",
            definition: () => `'alters perception to tolerate high incoherence';'reveals gaps'${page.maskHungerNote ? page.maskHungerNote : ''}`
        },

        /*
        joy: { //soon
            on: ()=>{ },
            off: ()=>{ },
            maskImage: `url(/img/mui/mask/joy.gif), url(/img/textures/dithertran.gif), url(/img/textures/memoryhaze.gif)`,
            showIf: "",
            definition: "'may reveal certain thoughts'"
        }
        */
    },

    mss: {
        state: 0.5,
        status: "coherent",
        code: 0
    }
}

var swup
var firstLoad = true
var oldPage = {}
var page
var scanner

//initialize the window when dom is ready
ready(()=>{
    change("TEMP!!lastvisit", check("lastload"))
    change("lastload", Date.now())

    if(localStorage['volume']) {
        Howler.volume(localStorage['volume'])
        document.querySelectorAll('.vol-slider').forEach(slider => slider.value = localStorage[slider.getAttribute('for')] || 1)
    } else Howler.volume(0.5) //we start them at 0.5, 1, 1
    
    scanner = document.querySelector('#mindspike-scanner')
    env.pressedKeys = {}
    body.addEventListener('keyup', function(e) {env.pressedKeys[e.key.toLowerCase()] = false})
    body.addEventListener('keydown', function(e) {env.pressedKeys[e.key.toLowerCase()] = true})

    /////////////////INTERACTIVE STUFF/////////////////////////
    //right clicking is disabled because we have a special context menu! 
    //when out of MUI mode, it will open the MUI (and open a menu when over targets)
    //when IN MUI mode, will just open a menu for the selected targets
    //the array of targets it reads from is set every 100ms a bit further down from here
    document.addEventListener('contextmenu', e=> {
        if(env?.rpg?.nevermind) { env.rpg.nevermind(); e.preventDefault() }
        if(e.target.tagName != "INPUT" && !e.target.classList.contains('allowmenu')) e.preventDefault()
    })

    //MUI examination handler
    //gets the index of the currently selected thingy in the scanner, prints out its examine message
    document.querySelector('#mindspike-examine').addEventListener('click', ()=>{
        let effectiveDef = env.targetedEntity.text
        
        const localization = getLocalizationForPage()
        if(localization.entityDescriptions) if(localization.entityDescriptions[env.targetedEntityName]) {
            effectiveDef = localization.entityDescriptions[env.targetedEntityName]
        }
        
        effectiveDef = effectiveDef.replace(/\n/g, "<br>")
        if(!env.targetedEntity.noProcess) effectiveDef = processDefinitionsInString(effectiveDef, {force: true})

        readoutAdd({message: effectiveDef, type: `examine ${env.targetedEntity.type}`, name: processStringTranslation(env.targetedEntity.displayName || env.targetedEntityName), image: env.targetedEntity.image})
        if(env.targetedEntity.exmExec) env.targetedEntity.exmExec()
        play('muiReadout')

        scanner.classList.remove('active')
        env.scannerOpen = false

        try { entityMarkScanned(env.targetedEntity) } catch(e){ /* no need to do anything, just means it's not a tracked entity */}
    })

    //MUI action handler
    //adds the acting class to the scanner, changing the display to the action one
    //will show options based on the entity object
    //clicking on a button submit will enact that action

    document.querySelector('#mindspike-act').addEventListener('click', ()=>{
        let actOptions = document.querySelector('#act-options')
        let actionNames = []
        actOptions.innerHTML=""
        scanner.classList.add('acting')

        function renderAction(action) {
            if(shouldItShow(action)){
                //add the option
                actOptions.insertAdjacentHTML('beforeend',`<div class="act-option ${action.class ? action.class : ""}">${processStringTranslation(action.name)}</div>`)
    
                //if the action has a response, display it - then exec if it has an exec
                actOptions.lastChild.addEventListener('click', function(){
                    if(action.message) {
                        var options = {message: action.message.text.replace(/\n/g, "<br>")}
                        if(action.message.actor) options.type = action.message.actor
                        else {
                            options.name = action.name
                            options.image = env.targetedEntity.image
                        }
                        readoutAdd(options)
                    }
    
                    if(action.exec) {
                        action.exec()
                    }
                    
                    let playSound = true
                    if(action.class) if(action.class.includes("nosound")) playSound = false
                    if(playSound) play('muiClick')
                    
                    scanner.classList.remove('active')
                    scanner.querySelectorAll(".act-option").forEach(action => action.classList.add("closeout"))
                    env.scannerOpen = false
                    document.dispatchEvent(new CustomEvent('corru_act', { detail: { action, entity: env.targetedEntity } }))
                })
            }
        }

        //load entity actions, assign their click handles
        env.targetedEntity.actions.forEach(action => {
            actionNames.push(action.name)
            renderAction(action)
        });

        //we add any global actions that aren't overidden
        env.globalActions.forEach(action=>{
            if(!actionNames.includes(action.name))
                if(action.specialCondition(env.targetedEntity))
                    renderAction(action)
        })
    })

    //closes out of action menu
    document.querySelector('#mindspike-back').addEventListener('click', ()=>{
        scanner.classList.remove('acting')
    })

    //general 'do certain things upon click' handler - all global click stuff (left and right click functions for MUI and hud elements) is in this one p much
    window.addEventListener('mousedown', ev=> {
        if(env?.rpg?.nevermind || ev.target.classList.contains('allowmenu') || ev.target.tagName == "INPUT") return

        //determine whether they're clicking an element that ignores scanner mechanics
        let excluded = false
        document.querySelectorAll('#combat .team').forEach(el=>{ if(el.contains(ev.target) && !excluded) excluded = true })

        if(!document.documentElement.classList.contains("cutscene")) { //don't do anything during cutscenes
            if(!scanner.contains(ev.target) || excluded) { //not clicking the mindspike menu or combat menus
                scanner.classList.remove('active')
                env.scannerOpen = false

                //catch elements that are already deleted - can happen with page-specific click events that remove stuff
                //also skips if excluded
                if(ev.target.parentElement == null || excluded) return

                //otherwise, do some target prep
                scannerGetTargets()

                //if clicking the meta icon, toggle MUI
                if(ev.target.id == "meta-icon") {
                    MUI("toggle")

                //if clicking on something under the meta menu, do whatever the link is for
                } else if(ev.target.parentElement.id == "mui-links"){
                    if(!body.classList.contains('in-menu')) {
                        switch(ev.target.id) {
                            case "meta-hub":
                                startDialogue('menu_hub')
                            break

                            case "meta-obs":
                                toggleEntMenu()
                            break

                            case "meta-sys":
                                toggleSysMenu()
                            break
                        }
                    }

                //if left clicking on a target in MUI, show context menu. 
                //if right clicking target, open MUI AND open a target menu. otherwise just open a target menu
                } else if((ev.target.classList.contains('target') || env.targeted.length > 0) && (!body.classList.contains('in-menu'))) {
                    switch(ev.button) {
                        case 0: 
                            if(env.mui) {
                                scannerOpen()
                            }
                        break

                        case 2: 
                            if(!env.mui) MUI("on")
                            scannerOpen()
                        break
                    }

                //if not hovering over a target or MUI element...
                //left click deactivates MUI (like clicking out of an overlay), or closes an active menu if clicked out of a menu box
                //right click toggles mui, or closes an active menu
                } else if(!document.querySelector('#readout').contains(ev.target) && !ev.target.classList.contains('target') && !ev.target.classList.contains('noclosemenu')) {
                    switch(ev.button) {
                        case 0: 
                            if(env.mui) MUI("off") //simply turn off the MUI if it's open
                            
                            //or if in a non-dialogue menu...
                            else if((body.classList.contains('in-menu') && !body.classList.contains('in-dialogue')) || body.classList.contains('in-tiny-menu')) { 
                                //detect if where you're clicking is outside of a menu-box
                                var inMenu = false
                                document.querySelectorAll('#meta-mask, [menu]').forEach(menu => {if(menu.contains(ev.target)) inMenu = true} )

                                //if you're clicking outside of a menu box, exit the menu!
                                if(!inMenu) {
                                    exitMenu()
                                }
                            }
                        break

                        case 2: 
                            //if right clicking while in a menu (but not dialogue), close the menu
                            if(body.classList.contains('in-menu') && !body.classList.contains('in-dialogue')) {
                                exitMenu()                       
                            } else {
                                MUI("toggle")
                            }
                        break
                    }
                } 

             
            } else if(scanner.contains(ev.target) && ev.target.classList.contains('arrow')) { //clicking a mindspike arrow
                let currentIndex = Number(scanner.style.getPropertyValue('--index'))

                //get the direction
                var change
                switch (ev.target.getAttribute('dir')) {
                    case "left":
                        change = -1
                    break

                    case "right":
                        change = 1
                    break
                }

                if((currentIndex == (env.targeted.length - 1)) && change == 1) { //if they're going over the max
                    env.targetIndex = 0
                } else if((currentIndex == 0) && change == -1) { //if they're going below zero
                    env.targetIndex = env.targeted.length - 1
                } else { //if they're just moving
                    env.targetIndex = currentIndex + change
                }

                scanner.style.setProperty('--index', env.targetIndex)
                env.targetedEntityParent = env.targeted[env.targetIndex].parentElement
                env.targetedEntityName = env.targeted[env.targetIndex].getAttribute('entity')
                env.targetedEntity = env.entities[env.targetedEntityName]
                entityShowActions(env.targetedEntity)
            }
        }
    })

    /*a bunch of times a second, check to see if...
    * 1) they're hovering over a target and the MUI is on - stores targets for a variety of fun activities
    * 2) they're hovering over an element with a definition - moves the definition box to the mouse, updates its text, and adds an active class
    */
    env.hoverIntervalRate = 100
    env.hoverFunc = () => {
        //definition tracking
        env.hovering = document.elementFromPoint(env.cursor.x, env.cursor.y)

        if(env.hovering) {
            if(env.hovering.hasAttribute('definition')) {
                //flip the position of the transform based on which side of the screen it's on
                if(env.cursor.x < (window.innerWidth / 2)) env.defbox.style.setProperty("--xFlip", 0); else env.defbox.style.setProperty("--xFlip", -1)
                if(env.cursor.y < (window.innerHeight / 2)) env.defbox.style.setProperty("--yFlip", 0); else env.defbox.style.setProperty("--yFlip", -1)

                env.defbox.classList.add('active')
                definitionRender(env.hovering)
            } else {
                env.defbox.classList.remove('active')
            }
        }

        //MUI tracking
        if(!env.mui || env.scannerOpen || env.muiProhibited) return
        scannerGetTargets()
    }

    env.hoverInterval = () => {
        setTimeout(()=>{
            env.hoverFunc()
            env.hoverInterval()
        }, env.hoverIntervalRate)
    }

    env.hoverInterval()


    //activate mousemove event - simply tracks position on both a window and doc level, used for a ton of things
    env.cursor = {x: 0, y: 0}
    env.pageCursor = {x: 0, y: 0}
    env.defbox = document.getElementById('definition-box')
    env.mouseThrottle = false
    env.mouseThrottleSpeed = 50
    env.toggleMouseThrottleLowSpeed = (set = "toggle") => {
        let on = set

        if(set == "toggle") {
            if(env.mouseThrottleSpeed == 50) {
                on = true
            } else {
                on = false
            }
        } 

        switch(on) {
            case true:
                env.mousethrottlespeed = 250
                env.defbox.classList.add("slow")
            break

            case false:
                env.mousethrottlespeed = 50
                env.defbox.classList.remove("slow")
            break
        }
    }

    window.addEventListener('mousemove', e=> {
        if (env.mouseThrottle) {
            return
        }
        env.cursor.x = e.clientX
        env.cursor.y = e.clientY
        
        env.pageCursor.x = e.pageX
        env.pageCursor.y = e.pageY
        
        if(!env.temporaryOptimize) { // limited during sensitive sequences, i.e. bullet hells
            env.defbox.style.setProperty("--x", env.cursor.x)
            env.defbox.style.setProperty("--y", env.cursor.y)

            if(typeof env.mouseMove == "function") env.mouseMove() //can be set up per page or per needs as to not need to manage page-internal mousemoves
        }

        env.mouseThrottle = true
        setTimeout(()=>env.mouseThrottle = false, env.mouseThrottleSpeed)
    })

    //load volume settings and get the spike-button functional first thing
    //this approach to multiple volume sliders was kinda inspired by max (@the_dem)'s crack at a mod for it!
    document.querySelectorAll('.vol-slider').forEach(slider => {
        let sliderFor = slider.getAttribute('for')

        slider.addEventListener('input', ev=>{
            localStorage[sliderFor] = ev.target.value
            switch(sliderFor) {
                case "volume": play("obeskHover"); Howler.volume(ev.target.value); break
                case "volume-sfx": play("obeskHover"); break

                case "volume-music": if(env.bgm) {
                    if(env.bgmIsFading) return;
                    env.bgm.volume(getModifiedVolume('music', env.bgm.intendedVol ? env.bgm.intendedVol : 1))
                }; break
            }
        })
    })

    document.querySelector('#meta-volume-toggle').addEventListener('click', e=>{
        var volume = localStorage['volume']
        if(volume > 0) volume = 0; else volume = 0.5

        document.querySelector('#meta-volume-slider').value = volume
        document.querySelector('#meta-volume-slider').dispatchEvent(new Event('input'))
    })

    /////////////////MENUUUUUUUUUUS////////////
    //sets up permanent system menu fixtures - exporting/importing flags
    //export management
    let saveText = document.querySelector('#savetext')
    document.querySelector('.sysblock #export').addEventListener('click', downloadSave)

    //mini inner function for both enter and clicking import
    function importSave(e) {
        e.preventDefault()
        mountSave(saveText.value)
    }

    //hitting enter on the input or clicking import will import from the textarea
    document.querySelector('.sysblock #import').addEventListener('click', importSave)
    saveText.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            importSave(e)
        }
    })

    //save deletion button 
    document.querySelector('.sysblock #delete').addEventListener('click', e=>{
        deleteSave()
    })

    //mod save button
    document.querySelector('.sysblock #savemods').addEventListener('click', ()=>{
        let modList = document.querySelector("#modtext").value
        if(modList) {
            let list = modList.split("\n")
            addResources(list)
            chatter({actor: 'sys', text: `ATTENTION::'${list.length} mod(s) initialized:<br>${list.join("<br>")}'`, readout: true})
        } else if(check("modList")) {
            chatter({actor: 'sys', text: `ATTENTION::'mods removed';'refresh for clean reinitialization'`, readout: true})
        } else {
            chatter({actor: 'sys', text: `ATTENTION::'no mods active';'no change rendered'`, readout: true})
        }

        change("modList", modList)
    })    

    ////////////////LOADING STUFF//////////////
    //start swup 
    swup = new Swup({
        containers: ["#content"],
        animationSelector: '#content',
        cache: false,
        animateHistoryBrowsing: false,
        skipPopStateHandling: (e => {return true}), //this outright breaks the back button, because fuck you? LOL
    })

    //set up page actions on swup change
    //moving into page
    swup.on('contentReplaced', function() {
        oldPage = page //saves old page for reference - mainly bgm removal
        setTimeout(()=>{
            eval(document.querySelector('#PageData').innerHTML) //overrides old page obj
            console.log('overrode previous page, calling onload')
            page.onLoaded()

            change("lastload", Date.now())
        }, 100)
    });

    //leaving page
    swup.on('transitionStart', function() {
        page.onLeaving()
        console.log('calling onleave')
    });

    //initialize page if this is the first load
    page.onLoaded()
    console.log('first load, calling onload')

    //////////////////AUDIOOOO/////////////////////////////////
    //audio for permanent fixtures
    document.querySelectorAll(`#mindspike-act, #mindspike-examine, #mindspike-back, #mui-links > *, #meta-icon, .menureturn, #meta-menu .moth-trigger, #system-menu summary, #system-menu .button`).forEach(e=>{
        e.addEventListener('mouseenter', ()=>play('muiHover'))
        e.addEventListener('click', ()=> play('muiClick'))
    })

    document.querySelectorAll(`#meta-menu .mask-trigger`).forEach(e=>{
        e.addEventListener('mouseenter', ()=>play('obeskHover'))
        e.addEventListener('click', ()=> play('obeskToggle'))
    })

    //////////////////////MISC DETECTION + ADJUSTMENTS//////////
    // when the page is reloaded, if the user has a log from the same session, restore it
    reloadSessionLog()

    //todo: come up with a better GPU check system. this relies on deprecated things that don't help that much
    runGPUCheck() //also check their GPU for acceleration cuz it sucks if they don't have it

    nonStandardScreenCheck() //called afterwards so that it's "over" the first warning

    //keep track of the browser height - we use this for certain transform scaling algorithms
    function updateUnitlessHeight() { document.documentElement.style.setProperty('--unitlessHeight', window.innerHeight) }
    window.addEventListener('resize', updateUnitlessHeight);
    updateUnitlessHeight()

    //if they have an active mask in their flags, it should start on that mask
    let loadedMask = check('mask')
    if(loadedMask != false) mask({name: loadedMask, retrigger: true, playSound: false});
    else mask({name: 'reality', retrigger: true, playSound: false})
    
    //chrome detection for fixing flickering
    if(window.chrome) {
        env.chrome = true
        body.classList.add('chromium');
    } else {
        body.classList.add("notchrome");

        //firefox windows detection to knock out stuff that causes the total browser render failure
        //this classname is used respectfully as i, too, am a firefreak.
        if(isFirefoxOnWindows()) {
            env.firefreak = true
            body.classList.add("firefreak");
        }
    }


    //moth tracker
    //we set this to be periodic rather than on every corru.changed, because otherwise it'd distract people i think
    //it already triggers as soon as you enter a new page anyway
    setInterval(mothHasUnreadCheck, 600000) // every 10m + on page load should be enough

    //load mods
    let mods = check("modList")
    if(mods) {
        let modList = mods.split("\n").filter(line => line.trim() !== "")
        addResources(modList)
        document.querySelector("#modtext").value = mods
        chatter({actor: 'sys', text: `ATTENTION::'${modList.length} mod(s) automatically initialized:<br>${modList.join("<br>")}'`, readout: false})
    }
})

//requires that you're on the page where the ent is defined
function entityMarkScanned(entity) {
    let currentPageEntities = flags['detectedEntities'][page.title]['entities']
    let trackedEntity = currentPageEntities[entity.name]

    //simply marks as scanned, OR marks the 'alternateOf' as scanned if the entity is an alternate version of some other one
    if(trackedEntity) {
        if(trackedEntity.scanned) return; // no action needed

        trackedEntity.scanned = true 
    } else if(currentPageEntities[entity.alternateOf]) {
        if(currentPageEntities[entity.alternateOf].scanned) return; // ditto

        currentPageEntities[entity.alternateOf].scanned = true
    }
    
    localStorage.setItem('flags', JSON.stringify(flags)) //saves
}

//arbitrary version. won't check for alternateOf so just use it intelligently
//relies on things already being encountered, just not scanned
//useful for when an entity is used across multiple pages
function entityOffPageMarkScanned(entityName, pageTitle) {
    let pageData = flags['detectedEntities'][pageTitle]
    if(!pageData) return console.warn(`page "${pageTitle}" not found in detectedEntities`);
    
    let pageEntities = pageData.entities
    let trackedEntity = pageEntities[entityName]
    
    if(trackedEntity) {
        if(!trackedEntity.scanned) {
            trackedEntity.scanned = true
            localStorage.setItem('flags', JSON.stringify(flags))
        } 
    }
    else return console.warn(`entity "${entityName}" not found on page "${pageTitle}"`);
}

//definition boxes
//most cases just show the definition defined in HTML, but some special cases exist
function definitionRender(defEl, {returnHTML = false} = {}) {
    if(env.defbox.rendering == defEl) return
    env.defbox.rendering = defEl
    let definition = defEl.getAttribute('definition')
    
    //if we're looking at an action, we want to sub in dynamic variables and use a special template
    if(definition.startsWith("ACTION++") && env.ACTIONS) {
        let template = `
        <div class="actiondef">
            <div class="actiondef-heading">
                <h5>[ACTIONNAME]</h5>
                <div class="actiondef-stats">
                    <span info="target">[TARGETS]</span>
                    <span info="hit">[HIT%]</span>
                    <span info="crt">[CRIT%]</span>
                </div>
            </div>
            
            <div class="actiondef-effect">
                <h6>EFFECT</h6>
                [ACTHELP] <!-- fallback only -->
                [flavor] <!-- smaller, extra display text if there isn't enough flavor room in onUse/onHit-->
                [onUse] <!-- general use effect i.e. focus -->
                [onHit] <!-- hit effect -->
                [onCrit] <!-- crit effect -->
                [conditional] <!-- if an action has some special other effect -->
            </div>
            
            <!-- statuses, etc -->
            <div class="actiondef-statuses">{STATUSES}</div>
        </div>
        `

        let action = env.ACTIONS[definition.split("++")[1]]
        if(!action) {
            env.defbox.innerHTML = `no definition for ${definition.split("++")[1]}. this is probably a bug`
            return
        }

        let statuses = new Set();
        const placeholders = template.match(/\[(.*?)\]/g)
        placeholders.forEach((placeholder) => {
            let replacement = ""
            //console.log("found", placeholder)
            
            switch (placeholder) {
                //the simple ones
                case '[ACTIONNAME]': replacement = action.name; break
                case '[HIT%]': 
                    let accuracy = action?.stats?.accuracy || action.accuracy
                    replacement = ((action?.stats?.autohit || action.autohit) ? "auto" : `${accuracy * 100}%`) || "auto";
                    if(replacement == "auto" || accuracy >= 1) {
                        replacement = `<span class="friend-shadow">${replacement}</span>`
                    } else if(accuracy <= 0.6) {
                        replacement = `<span class="obesk-shadow">${replacement}</span>`
                    } else if(!accuracy) {
                        replacement = `100%`
                    }
                break
                case '[CRIT%]': 
                    let crit = action?.stats?.crit || action.crit
                    replacement = crit ? `${crit * 100}%` : "";
                    if(crit >= .9) {
                        replacement = `<span class="friend-shadow">${replacement}</span>`
                    } else if(crit <= 0.4) {
                        replacement = `<span class="obesk-shadow">${replacement}</span>`
                    }
                break

                //effects
                case '[ACTHELP]': // fallback for actions not yet updated to new system
                    if(!action.details && action.help) replacement = action.help.replaceAll(", ", "\n");
                    else if(!action.details) replacement = "ERROR::'unknown effect'"                    
                break

                case '[TARGETS]':
                    if(action.type.includes('target') && action.type.includes('self')) {
                        replacement = "<span class='bright-color'>any</span>"
                    } else if(action.type.includes('movement') || action.type.includes('ground')) {
                        replacement = "<span class='neutral-color'>location</span>"
                    } else if(action.type.includes('target')) {
                        replacement = "<span class='bright-color'>other</span>"
                    } else if(action.type.includes('special')) {
                        replacement = "<span class='obesk-shadow'>special</span>"                        
                    } else if(action.type.includes('autohit')) {
                        replacement = "<span class='friend-shadow'>self</span>"
                    }
                break

                case '[onUse]':
                case '[onHit]':
                case '[onCrit]':
                case '[conditional]':
                    if (action.details) {
                        let type = placeholder.slice(1, -1) //remove the brackets
                        let template = action.details[type]
                        if(typeof template == "function") template = template();

                        if(template) {
                            const statPlaceholders = template.match(/\[(STAT|STATUS)::(.*?)\]/g)

                            if(statPlaceholders) statPlaceholders.forEach((statPlaceholder) => {
                                let [_, type, statKey] = statPlaceholder.match(/\[(STAT|STATUS)::(.*?)\]/)
                                let statDisplay = ""
                                let statClass = "neutral-shadow"

                                switch(type) {
                                    case "STATUS":
                                        let info = action.stats.status[statKey]
                                        let status = env.STATUS_EFFECTS[info.name]
                                        if(status.beneficial) statClass = "status friend-shadow"; else statClass = "status obesk-shadow"
                                        statDisplay = `${status.name}`
                                        if(isFinite(info.length)) { // we only add to the display if a length is specified                                            
                                            statDisplay = `${info.length < 0 ? "-" : `+`}${status.infinite || status.passive ? '' : `${info.length}T:`}${statDisplay}`
                                            statuses.add(status)
                                        } else if(info.showReference) { // or if it's for reference
                                            statuses.add(status)
                                        }
                                    break
                                    
                                    default: //stat
                                        let statNum = action.stats[statKey]
                                        switch(statKey) {                                            
                                            case "crit": statDisplay = `${statNum * 100}%`; break;
                                            case "accuracy": statDisplay = `${statNum * 100}%`; break;
                                            case "kb": statDisplay = `KB::${statNum}`; statuses.add(env.STATUS_EFFECTS['kb']); break;
                                            case "bp": case "amtBP":
                                                statDisplay = `<span class="actiondef-bp">${statNum > 0 ? `+${statNum}` : statNum}BP</span>`; 
                                                if(statNum > 0) statClass = "friend-shadow"; else statClass = "obesk-shadow"
                                                statuses.add(env.STATUS_EFFECTS['bp']);
                                            break;
                                                
                                            default: 
                                                if(statKey.includes("HP") || statKey == "amt") {
                                                    statDisplay = `${(-statNum) > 0 ? `+${-statNum}` : -statNum}HP`; 
                                                    if(statNum < 0) statClass = "friend-shadow"; else statClass = "obesk-shadow"
                                                } else statDisplay = statNum; 
                                            break;
                                        }
                                }

                                
                                template = template.replace(statPlaceholder, statDisplay ? `<span class="${statClass}">${statDisplay}</span>` : "")
                            })

                            replacement = `<span class="actiondef-${type.toLowerCase()}">${template}</span>`;
                        }
                    }
                break

                default:
                    let type = placeholder.slice(1, -1) //remove the brackets
                    if(action.details) if(action.details[type]) replacement = `<span class="actiondef-${type.toLowerCase()}">${action.details[type]}</span>`
                break
            }
            
            template = template.replaceAll(placeholder, replacement)
        })

        if(statuses.size) {
            let statusesHTML = ""
            
            statuses.forEach(status => {
                let removes = ""
                if(status?.removes?.length) {
                    status.removes.forEach(removeSlug => {
                        let removeStatus = env.STATUS_EFFECTS[removeSlug]
                        if(removeStatus.advancedStatus && !page.showAdvancedStatuses) return;
                        removes += `, <span class="status-removes ${removeStatus.beneficial ? `friend-color` : `obesk-color`}">-<img class="actiondef-status-icon" src="${removeStatus.icon || `/img/sprites/combat/statuses/${removeStatus.slug}.gif` }" aria-hidden='true'>${removeStatus.name}</span>`
                    })
                }

                statusesHTML += `
                    <div class="actiondef-status ${status.beneficial ? 'beneficial' : status.justForDisplay ? 'infodisplay' : ''}">
                        <img class="actiondef-status-icon" src="${status.icon || `/img/sprites/combat/statuses/${status.slug}.gif`}" aria-hidden='true'>
                        <h6>${status.name}::</h6><span>${processHelp(status)}${removes}</span>
                    </div>
                `
            })
            //console.log("HTML updated", statusesHTML)

            template = template.replace("{STATUSES}", statusesHTML);
        } else template = template.replace("{STATUSES}", "")

        // Replace the template in the env.defbox.innerText
        if(returnHTML) {
            return template
        } else {
            env.defbox.setAttribute("for", "action")
            env.defbox.innerHTML = template
        }

    //it's an action hover, but actions aren't defined (as referenced in logic of above block)
    } else if(definition.startsWith("ACTION++")) {
        env.defbox.setAttribute("for", "regular")
        env.defbox.innerHTML = "ERROR::'missing context'"

    } else if(definition.startsWith("TILE++") && defEl.classList.contains("effectbearer") && defEl.effects && CombatGrid) {
        let effectList = ""
        defEl.effects.forEach(tileEffectPointer => {
            let effect = tileEffectPointer.host
            if(!effect.help) return;

            //optional additional array of things to show
            let dataList = ""

            effectList += `
                <div class="actiondef-status ${effect.beneficial ? 'beneficial' : ''}">
                    <h6>${effect.name}::</h6><span>${processHelp(effect)}</span>
                    ${dataList ? `
                        <div class="actiondef-datalist">${dataList}</div>
                    `: ''}
                    <div class="actiondef-origin">
                        <span class="actiondef-tile-origin"><h6>ORIGIN::</h6>${effect.origin.name || "unknown"}</span>
                        ${effect.infinite ? "" : `<span class="actiondef-tile-length">${tileEffectPointer.length}T</span>`}
                    </div>
                </div>
            `
        })
        

        let template = `
        <div class="actiondef tiledef">
            <div class="actiondef-statuses">${effectList}</div>
        </div>
        `

        if(returnHTML) {
            return template
        } else {
            env.defbox.setAttribute("for", "tile")
            env.defbox.innerHTML = template
        }
    } else if(definition.startsWith("STATUS++") && env.STATUS_EFFECTS) {
        let statusSlug = definition.split("++")[1]
        let statusObj = defEl.statusObj || env.STATUS_EFFECTS[statusSlug]
        if(!statusObj) {
            env.defbox.innerHTML = `no definition for ${statusSlug}. this is probably a bug`
            return
        }

        const statusesHTML = `
            <div class="actiondef-status ${statusObj.beneficial ? "beneficial" : ""} ${statusObj.passive ? "passive" : ""} ${env.crittaMap && statusObj.impulse ? "impulse" : ""}">
                <img class="actiondef-status-icon" src="${statusObj.icon || `/img/sprites/combat/statuses/${statusObj.slug}.gif`}" aria-hidden="true">
                <h6>${statusObj.name}::</h6><span>${processHelp(statusObj)}</span>
            </div>
        `
        const template = `
            <div class="actiondef statusdef">
                <div class="actiondef-statuses">${statusesHTML}</div>
            </div>
        `

        if(returnHTML) {
            return template
        } else {
            env.defbox.setAttribute("for", "status")
            env.defbox.innerHTML = template
        }

    } else { // default
        if(returnHTML) {
            return defEl.getAttribute('definition')
        } else {
            env.defbox.setAttribute("for", "regular")
            env.defbox.innerHTML = defEl.getAttribute('definition')
        }
    }
}

//chatter
//little tooltip-esque popups over talking entities
//takes an ID of an element with a .chatter div, how long the message ought to show, and the message
//also does a readout if that's specified
function chatter({actor, text, duration = 6000, sfx = true, delay = 0, log = true, readout = false, customEl}) {
    let finalText = processDefinitionsInString(processStringTranslation(text))

    env.setTimeout(()=>{
        let actorObj = getDialogueActor(actor)
        let parentEl = customEl || document.querySelector(actorObj.element)
        
        //return if you're in dialogue with whoever this is already
        if(env.currentDialogue.active == true && env.currentDialogue.actors[actor] != undefined) return

        //otherwise show the chatter if the element still exists
        if(parentEl) {
            var chatterEl = parentEl.querySelector('.chatter-container')       

            //if the chatter container doesn't exist, add it
            if(!chatterEl) {
                parentEl.insertAdjacentHTML('beforeend','<div class="chatter-container"></div>')
                chatterEl = parentEl.querySelector('.chatter-container')       
            }

            env.totalMessages++

            let chatterID = `chat${env.totalMessages}`
            chatterEl.insertAdjacentHTML('beforeend', `<div class="chatter" id="${chatterID}">${finalText}</div>`)

            setTimeout(()=>{
                try{
                    document.querySelector(`#${chatterID}`).remove()
                } catch(e) { console.log('chatter aborted due to element removal') }
            }, duration)
        }

        if(log) { 
            let logMessage = Object.assign({}, actorObj)
            logMessage.name = actor || actorObj.name
            logMessage.displayName = actorObj.name || actor
            logMessage.message = finalText
            logMessage.show = readout //stops the minireadout popup from appearing by default
            logMessage.forceMini = readout //but if true, forces the minireadout to show

            // option to only show mini if readout is not open
            if(readout == "closed") {
                logMessage.show = !env.mui
                logMessage.forceMini = !env.mui
            }

            logMessage.sfx = sfx ? actorObj.activeVoice || actorObj.voice : false
            readoutAdd(logMessage) 
        }
    }, delay)
}

//readout controls
//print a message on the readout
//if an actor name (should be in dialogueActors) is provided, uses info from that instead
function readoutAdd({message, type = "", name, displayName, image = false, show = true, forceMini = false, sfx = true, actor = false, noStore = false}) {
    let readout = document.querySelector('#readout')
    let miniReadout = document.querySelector('#minireadout')
    let effectiveMessage = message
    // console.log("readoutAdd got displayName", displayName)

    var addition
    if(actor) {
        // console.log("actor path")
        if(actor.name == "unknown") return
        let actorObj = getDialogueActor(actor)
        effectiveMessage = processStringTranslation(actorObj.noProcess ? effectiveMessage : processDefinitionsInString(effectiveMessage))
        addition = getReadoutMsg({message: effectiveMessage, image: actorObj.image, displayName: processStringTranslation(displayName), name: actor || displayName, type: actorObj.type, msgClass: actorObj.class})
    } else {
        //console.log("actorless path")
        addition = getReadoutMsg({message: processStringTranslation(name == "moth" || name == "sys" ? effectiveMessage : processDefinitionsInString(effectiveMessage)), type: type, name, displayName: processStringTranslation(displayName), image: image})
    }

    //add the message to the main readout
    readout.insertAdjacentHTML('beforeend', addition)
	readout.scrollTop = readout.scrollHeight //scroll to it on the readout too

    //if the readout isn't open and you aren't in dialogue... (unless forced to show)
    //add the message to the mini readout, with a timer to remove it after a few seconds
    if(show) {
        if((!body.classList.contains('mui-active') && !body.classList.contains('in-dialogue')) || forceMini) {
            miniReadout.insertAdjacentHTML('beforeend', addition)
            let newMessage = document.querySelector(`#minireadout .message-${env.totalMessages}`)
            setTimeout(() => {
                newMessage.classList.remove('active')
                setTimeout(()=>newMessage.remove(), 1000)
            }, 5000);
        }
    }

    //reveal all added stuff after a tiny delay
    let currentMessageNum = env.totalMessages
    setTimeout(()=>document.querySelectorAll(`.message-${currentMessageNum}`).forEach(e=>e.classList.add('active')), 50)
    env.totalMessages++
	
    //play readout add sound if not in dialogue, and also it should be shown
    if(!env.currentDialogue.active) {
        if(sfx == true) play('muiReadout') //no custom sound
        else if(typeof sfx == "function") sfx()
        else if(typeof sfx == "string") play(sfx)
        else if(typeof sfx == "object") {
            play(sfx.sound, sfx.pitch)
        }
    }

    //store message in session log in case of refreshes
    //not too many though cause it used to be 1000 and that's a ton LOL
    if(!noStore) {
        if(env.logStore.length > 80) env.logStore.shift();
        env.logStore.push(addition)
        sessionStorage['log'] = JSON.stringify(env.logStore)
    }

    //also limit number of log entries that can show - used to be limitless, but we need a limit
    if (readout.children.length > 80) {
        var elementsToRemove = readout.children.length - 80
    
        for (var i = 0; i < elementsToRemove; i++) {
            readout.removeChild(readout.children[0])
        }

        readout.insertAdjacentHTML('afterbegin', `<div class="message sourceless active">${processStringTranslation("internal log buffer cleared after reaching limit (80) due to attached external record device")}</div>`)
    }
}

//gets the HTML for a given readout message
function getReadoutMsg({message, type = "", name, displayName: inputDisplayName, image, msgClass}) {
    var content = "", header = "", eClass = "", effectiveType = type;
    let displayName = inputDisplayName || name
    //console.log("proceeding with name", displayName, "from selection", inputDisplayName, name)

    //only set the image if it isn't moth (this will most likely be less specific down the line)
    // console.log("getReadout is", image, name)
    if(image && name != "moth") {
        header = header + `<img src='${image}'>`
    }

    //actor specific checks
    if(name && name != "sys" && !type.includes("sourceless")) { //actor isn't system or narration, so add their name with the usual prefix/affix
        header = header + `<h2>!!__${displayName.replace(/ /g, '_')}__!!</h2>`
    } else if (name == "sys") { //actor IS system, so skip for now
        effectiveType = "sys"
    }
    if (name == "moth") effectiveType = "moth" //actor is moth

    if(typeof message == "string") if(message != undefined && !(message.includes("<"))) { //if there's a message and it DOES NOT contain HTML
        message = `<p ${msgClass ? `class="${msgClass}"` : ""}>` + message + "</p>" //surround it with p tags 
    }

    //effectiveType handles specific actors that may have unique appearances on the readout
    switch(effectiveType) {
        case("moth"):
            header = `<img src="/img/blank.gif">` + header
            content = message
            eClass = "moth"
            break

        case("sys"):
            header = `<img src='/img/mui/mindspikelogoactive.gif'>`
            content = message
            eClass = "sys"
            break

        default: 
            content = `${message}`
    }

    //create the final string for the readout message
    var addition = `
        <div class='message ${eClass} ${type} message-${env.totalMessages}' actor="${name}">
            ${header}
            ${content}
        </div>
    `

    return addition
}

//restores the log from the current session - used primarily for refresh points
function reloadSessionLog() {
    if(!sessionStorage['log']) return

    env.logStore = JSON.parse(sessionStorage['log'])
    let readout = document.querySelector('#readout')

    const parser = new DOMParser();
    const fragment = document.createDocumentFragment();
    const messageClassRegex = /message-\d+/;

    env.logStore.forEach(log => {
        const noNumLog = log.replace(messageClassRegex, '');
        const doc = parser.parseFromString(noNumLog, 'text/html');
        const node = doc.body.firstChild;
        
        node.classList.add('active', 'message-restored');
        fragment.appendChild(node);
    });
    
    readout.appendChild(fragment);
    readoutAdd({message: `NOTE::'restored partial recent log'`, name:"sys", noStore: true, show: false, sfx: false})
}

//entity creation for page use
//takes an entity object with a name - adds it to the environment, then adds to the detectedEntities object for the page it's presently on
function createEntity(entObj) {
    env.entities[entObj.name] = entObj

    //we don't create the entity if it requests to be hidden,
    //OR if it requests to be limited to a certain page 
    //  (useful for entities from one page that need to show up on another, but without adding to the entity list)
    if(
        entObj.hide
        || ((entObj.pathLimit) && (entObj.pathLimit != page.path))
    ) return

    //detect if page is in detctedEntities - if not, add it with relevant info
    if(!flags['detectedEntities'][page.title]) {
        flags['detectedEntities'][page.title] = {
            title: page.title,
            path: location.pathname,
            order: page.order,
            image: page.image || '/img/textures/corruripple.gif',
            entities: {}
        }
    }

    var alreadyScanned
    try { alreadyScanned = flags['detectedEntities'][page.title]['entities'][entObj.name].scanned } 
    catch(e) { alreadyScanned = false }

    let prunedObj = JSON.parse(JSON.stringify(entObj))
    delete prunedObj.actions //we don't need to store this
    prunedObj.text = processDefinitionsInString(processStringTranslation(prunedObj.text))

    flags['detectedEntities'][page.title]['entities'][entObj.name] = prunedObj //this WILL NOT STORE ANY FUNCTIONS - just text/obj info
    if(alreadyScanned) flags['detectedEntities'][page.title]['entities'][entObj.name].scanned = true
}

//MUI action 'has any actions that should show' checker
//if it has valid actions, let the scanner show the ACT button
//otherwise do not
function entityShowActions(){
    var hasActions = false

    if(env.targetedEntity.actions) {
        env.targetedEntity.actions.forEach(action => {
            if(shouldItShow(action)) hasActions = true
        })
    }

    if(hasActions) scanner.classList.add('has-actions')
    else scanner.classList.remove('has-actions')
}

//MUI mouse target detection function
// todo: this is pretty inefficient. need to revisit
function scannerGetTargets() {
    env.targeted = []

    let targets = document.elementsFromPoint(env.cursor.x, env.cursor.y)
    targets.forEach(el => {
        if(el.classList.contains('target')) {
            el.classList.add('targeted')
            env.targeted.push(el)
        }
    })

    env.targeted.sort((a, b) => {
        const ao = parseInt(a.getAttribute('priority') || '0', 10)
        const bo = parseInt(b.getAttribute('priority') || '0', 10)
        return bo - ao
    })

    //un-target any previously targeted targets (wow) that aren't under the mouse anymore
    document.querySelectorAll('.targeted').forEach(el=>{
        if(!Array.from(targets).includes(el)) {
            el.classList.remove('targeted')
        }
    })
}

//MUI activation function
function scannerOpen() {
    if(env.mui && env.targeted.length) {
        //resets the menu
        let scannerEnts = document.querySelector('#mindspike-entities')
        scannerEnts.innerHTML = ``
        env.scannerOpen = true
        env.targetIndex = 0
        scanner.style.left = `${env.cursor.x}px`
        scanner.style.top = `${env.cursor.y}px`
        scanner.style.display = `flex`
        scanner.style.setProperty('--index', 0)
        scanner.classList.remove('multiple', 'active', 'acting', 'has-actions')
        scanner.classList.add('anim-in')

        //get first target
        env.targetedEntityParent = env.targeted[0].parentElement
        env.targetedEntityName = env.targeted[0].getAttribute('entity')
        env.targetedEntity = env.entities[env.targetedEntityName]
        entityShowActions(env.targetedEntity)

        //reveals after a slight delay so that transitions can happen again
        setTimeout(() => {
            scanner.classList.add('active')
            scanner.classList.remove('anim-in')
        }, 40)
        
        //add HTML for each element
        env.targeted.forEach(entity => {
            scannerEnts.insertAdjacentHTML('beforeend',`<span class="${env.entities[entity.getAttribute('entity')].type}">${processStringTranslation(entity.getAttribute('entity')).replace(/ /g, '_')}</span>`)
        })

        //if there's more than one target, add the selection arrows
        if(env.targeted.length > 1) {
            scannerEnts.insertAdjacentHTML('beforeend', `<div id="mindspike-left" class="arrow" dir="left"><</div><div id="mindspike-right" class="arrow" dir="right">></div>`)
            document.querySelectorAll(`#mindspike-left, #mindspike-right`).forEach(e=>{
                e.addEventListener('mouseenter', ()=>play('muiHover'))
                e.addEventListener('click', ()=> play('muiClick'))
            })
        }

        play('muiScanner')
    } else if(!body.classList.contains('mui-prohibited')) { //if mui is inactive and the body isn't mui-prohibited, activate mui
        MUI("on")
    }
}

//MUI toggles
function MUI(state) {
    switch(state) {
        case "prohibit":
            body.classList.add('mui-prohibited')
            env.muiProhibited = true
        break;
        case "deprohibit":
            body.classList.remove('mui-prohibited')
            env.muiProhibited = false
        break;
    }

    //return if prohibited, or in a transition
    if(body.classList.contains('in-menu') || body.classList.contains('mui-prohibited') || body.getAttribute('state') == "corru-loaded" || body.classList.contains("loading") || body.getAttribute('state') == "corru-leaving") return

    switch(state){
        case "toggle":
            if(env.mui) MUI("off")
            else MUI("on")
        break

        case "on":
            if(!env.mui) play('muiToggle')
            body.classList.add('mui-active')
            env.mui = true
        break

        case "off":
            if(env.mui) play('muiToggle')
            body.classList.remove('mui-active')
            env.mui = false
            
            scanner.classList.remove('active')
            env.scannerOpen = false
        break
    }
}

/* 
    ENTITY MENU
    Toggles the 'viewed pages and their entities' menu.
    if it's not open, add appropriate classes to body and then build + replace contents
    if it is open, close it
*/
function toggleEntMenu() {
    if(body.getAttribute('menu') == "entities")  {
        body.classList.remove('in-menu')
        body.setAttribute('menu', 'none')
    } else {
        MUI('off')
        document.querySelector('#entcontent').innerHTML = ""
        var menuContents = ``

        //for each page, build a div that contains all of the entities in that page, obscuring ones not seen yet
        for (const pageName in flags.detectedEntities) {
            const thisPage = flags.detectedEntities[pageName]
            var entListHTML = ""

            var entCount = 6 //starts at "one row"
            for (const entityName in thisPage.entities) {
                const entity = thisPage.entities[entityName]

                if(entity.pathLimit && (entity.pathLimit != thisPage.path)) {
                    delete thisPage.entities[entityName]
                    continue
                }

                if(entity.scanned) {
                    entListHTML += `<div class="ent scanned ${entity.type}" pagename="${pageName}" entname="${entity.name}" definition="ENTITY::'${entity.name}'" style="transition-delay: ${0.05 * entCount++}s"><img src="${entity.image}"></div>`
                } else if(!entity?.type.includes("no-show")) {
                    entListHTML += `<div class="ent unscanned ${entity.type}" definition="ENTITY::'unprocessed'::RECOMMEND::'relocation';'[EXM]'" style="transition-delay: ${0.05 * entCount++}s"><img src="/img/textures/static.gif"></div>`
                }                
            }

            menuContents += `<div class="page collapsed" page="${thisPage.title.replace(/[\W_]+/g,"")}" style="--pageImg: url(${thisPage.image}); --entRows: ${Math.floor(entCount/6) || 1}; --pageOrder: ${thisPage.order}">
                <div class="pageheader"><span>${thisPage.title}</span></div>
                <div class="pageents-wrapper">
                    <div class="pageents">${entListHTML}</div>
                </div>
            </div>`

            updateFlags()
        }

        //add html
        document.querySelector('#entity-menu .pagelist').innerHTML = ""
        document.querySelector('#entity-menu .pagelist').insertAdjacentHTML('beforeend', menuContents)

        //sfx for hover, etc
        document.querySelectorAll(`#entity-menu .pageheader, #entity-menu .ent[entname]`).forEach(e=>{
            e.addEventListener('mouseenter', ()=>play('muiHover'))
            e.addEventListener('click', ()=> play('muiClick'))
        })

        //collapse toggle
        document.querySelectorAll('#entity-menu .pageheader').forEach(e=>{ //pageheaders collapse/uncollapse their parents
            e.addEventListener('click', ()=>e.parentElement.classList.toggle('collapsed'))
        })

        //entity info view event
        document.querySelectorAll('#entity-menu .ent').forEach(e=>{
            if(e.getAttribute('entname')) {
                e.addEventListener('click', ()=>{
                    let entity = flags.detectedEntities[e.getAttribute('pagename')]['entities'][e.getAttribute('entname')]
                    let container = document.querySelector('#entcontent')
                    container.innerHTML = ""

                    let replay = getReadoutMsg({message: entity.text.replace(/\n/g, "<br>"), type: `examine ${entity.type}`, name: entity.displayName || entity.name, image: entity.image})
                    container.insertAdjacentHTML('beforeend', replay)
                    setTimeout(()=>container.querySelector('.message').classList.add('active'), 5)
                })
            }
        })

        //show menu
        body.classList.add('in-menu')
        body.setAttribute('menu', 'entities')
        play('muiScanner')
    }
}

/* 
    SYSTEM MENU 
    nothing crazy, just toggling
    more stuff will happen here in the future most likely (i.e. settings)
    we actually turn on the MUI since some things are logged here
*/
function toggleSysMenu() {
    if(body.getAttribute('menu') == "system")  {
        MUI('off')
        body.classList.remove('in-menu')
        body.setAttribute('menu', 'none')
    } else {
        //show menu
        MUI('on')
        body.classList.add('in-menu')
        body.setAttribute('menu', 'system')
        play('muiScanner')
    }
}

function updatePreferenceAttributes() {
    body.setAttribute('quality', (check('default_quality') || "regular").replace("high", "regular"))
    body.setAttribute('low_intensity', check('low_intensity'))
    body.setAttribute('gameplay_off', check('gameplay_off'))
    
    switch(check("size_preference")) {
        case "normal":
            document.documentElement.classList.remove("bigmode")
        break

        case "large":
            document.documentElement.classList.add("bigmode")
        break
    }

    setTimeout(()=>document.querySelector('#readout').scrollTop = document.querySelector('#readout').scrollHeight, 1000)
}

function setQualityPreference(pref) {
    chatter({actor: 'sys', text: `ATTENTION::'default quality';'set to ${pref}'`, readout: true})
    change('default_quality', pref)
    updatePreferenceAttributes()
}

function setIntensityPreference(pref) {
    if(pref) chatter({actor: 'sys', text: `ATTENTION::'reduced intensity alternatives active'`, readout: true})
    else chatter({actor: 'sys', text: `ATTENTION::'reduced intensity alternatives inactive'`, readout: true})

    change('low_intensity', pref)
    updatePreferenceAttributes()
}

function setGameplayPreference(pref) {
    if(pref) chatter({actor: 'sys', text: `ATTENTION::'gameplay enabled'`, readout: true})
    else chatter({actor: 'sys', text: `ATTENTION::'gameplay disabled'`, readout: true})

    change('gameplay_off', !pref)
    updatePreferenceAttributes()
}

function setSizePreference(pref) {
    chatter({actor: 'sys', text: `ATTENTION::'interface size';'set to ${pref}'`, readout: true})
    change('size_preference', pref)
    updatePreferenceAttributes()
}

/* MASK MENU */
function toggleMasksMenu() {
    if(body.getAttribute('menu') == "masks")  {
        body.classList.remove('in-tiny-menu', 'expand-menu')
        body.setAttribute('menu', 'none')
        play('obeskToggle')
    } else {
        //construct new contents
        let menuContents = ``
        let i = 0
        for (const maskName in env.masks) {
            const mask = env.masks[maskName];

            if(shouldItShow(mask)) {
                menuContents += `
                    <span 
                        class="ozo-mask ozo-mask-${maskName} ${check('mask') == maskName ? "active" : ""}"
                        style="
                            --maskImage: ${mask.maskImage};
                            --maskDelay: ${0.3 + (i * 0.1)}s;
                        "
                        definition="${maskName.toUpperCase()}::${typeof mask.definition == "function" ? mask.definition() : mask.definition}"
                        mask="${maskName}"
                    >
                        ${maskName}
                    </span>
                `
                i++
            }
        }

        //replace
        document.querySelector('#masks .ozo-mask-grid').innerHTML = menuContents
        
        //sfx for hover, etc
        document.querySelectorAll(`#meta-menu .ozo-mask`).forEach(e=>{
            e.addEventListener('mouseenter', ()=>play('obeskHover'))
            e.addEventListener('click', ()=> {
                let thisMask = e.getAttribute('mask')
                play('obeskClick')

                //handle mask swap on click
                if(check('mask') != thisMask) {
                    mask({name: thisMask})
                    
                    document.querySelectorAll('.ozo-mask.active').forEach(el=>el.classList.remove('active'))
                    e.classList.add('active')
                }
            })
        })

        //show menu
        body.classList.add('in-tiny-menu', 'expand-menu')
        body.setAttribute('menu', 'masks')
        play('obeskToggle')
    }
}

/* STORY STATE CONTROLS */

//episode progress - will mark or unmark the page with classes based on the 'episode' the player is in
//additionally checks to see if the 'advance log' option should appear
function checkEpisodeProgress(){
    if(check('ep0_epilogue') && check('ep1_showmaterials')) { 
        body.classList.add('ep1'); env.ep1 = true 
    } else { 
        body.classList.remove('ep1'); env.ep1 = false 
        env.fakenet = 0
    }
    
    if(check('fbx__ep2intro-end')) { 
        body.classList.add('ep2')
        env.ep2 = true 
    } else { 
        body.classList.remove('ep2')
        env.ep2 = false 
    }

    if(check('fbx__ep3intro')) { 
        body.classList.add('ep3')
        env.ep3 = true 
    } else { 
        body.classList.remove('ep3')
        env.ep3 = false 
    }

    if(check("ozo__council-task")) {
        body.classList.add('masksunlocked')
    }

    if(check('fbx__ep4intro')) { 
        body.classList.add('ep4')
        env.ep4 = true 
    } else { 
        body.classList.remove('ep4')
        env.ep4 = false 
    }

    if(
        (check('ep0_epilogue') && !check('ep1_showmaterials')) ||
        (check('ep1_end') && !check('fbx__ep2intro-end')) ||
        (check('embassy__d3_movefriend_finish') && !check('fbx__ep3intro')) ||
        (check('gol__bossclear') && !check('fbx__ep4intro'))
    ) {
        document.querySelector('#advance-notice').classList.add('active')
    } else {
        document.querySelector('#advance-notice').classList.remove('active')
    }
}

///////////////////////////////////////////helpers
//simple error reporter
function printError (e, showErrorWarning = true) { 
    if(showErrorWarning == "verbatim") chatter({actor: 'actual_site_error', text: e, readout: true})
	else if(showErrorWarning) chatter({actor: 'actual_site_error', text: "something actually fucked up (not a part of the story) details are in the log and console", readout: true})
	chatter({actor: 'actual_site_error', text: e})
    console.warn(e)
    console.trace()
}

//for use in letting someone close a menu that may have changes
//returns true if warning needed to be shown, false if not
function unsavedMenuWarning() {
    if(!env.allowMenuClose && env.unsavedChanges) {
        chatter({actor: 'sys', text: "WARNING::'unsaved changes';'attempt again to forfeit current changes'", readout: true})
        setTimeout(()=>env.allowMenuClose = true, 500)
        return true
    } else {
        env.allowMenuClose = false
        return false
    }
}

//easy menu exit
function exitMenu(closeMUIToo = true) {
    if(unsavedMenuWarning()) return

    delete env.draggable
    switch(body.getAttribute('menu')) {
        case "augment":
            play('obeskToggle')
        break

        case "party":
            toggleCrittaMenu()
        break

        default:
            play('muiToggle')
    }

    body.classList.remove('in-menu', 'in-tiny-menu', 'expand-menu')
    body.setAttribute('menu', 'none')
    if(window.vn) {
        vn.hideStage(false, false)
        vn.fadeChars(false)
    }

    if(closeMUIToo) MUI('off')
    env.unsavedChanges = false
}

//jquery document.ready equivalent
function ready(fn) {
    if (document.readyState != 'loading'){
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

//cutscene toggles
function cutscene(state) {
    if(state) {
        document.documentElement.classList.add('cutscene')
        env.cutscene = true
    } else {
        document.documentElement.classList.remove('cutscene')
        env.cutscene = false
    }
}

//current save deleter
function deleteSave() {
    MUI('off'); flash(true); cutscene(true); exitMenu();
    if(env.bgm) env.bgm.fade(env.bgm.volume(), 0, 10000)
    corruStatic.play()
    corruStatic.fade(0, getModifiedVolume('music', 1), 5000)
    MUI('prohibit');

    readoutAdd({message: `ATTENTION::'clearing mindspike cache';'15 seconds';'refresh to cancel'`, name:"sys"})
    setInterval(()=>play('muiHover', 2), 1000);
    setTimeout(()=>readoutAdd({message: `ATTENTION::'clearing mindspike cache';'in 10 seconds';'refresh to cancel'`, name:"sys"}), 5000)
    setTimeout(()=>readoutAdd({message: `ATTENTION::'clearing mindspike cache';'in 5 seconds';'refresh to cancel'`, name:"sys"}), 10000)
    setTimeout(()=>{ readoutAdd({message: `ATTENTION::'clearing mindspike cache';'now'`, name:"sys"}); play('muiToggle', 0.5)}, 14000)
    setTimeout(()=>{
        flags = undefined
        localStorage.removeItem('flags')
        location.replace('/')
    }, 16000)
}

//save mounter
function mountSave(savestring, reload = true) {
    if(!savestring) {
        readoutAdd({message: `ERROR::'data unspecified';'insert data into input slot'`, name:"sys"});
        return
    }

    try {
        let saveVersion = savestring.split("::")[0]
        let saveData = savestring.split("::")[1]
        let saveVersionMessage
        var decodedSave

        switch(saveVersion) {
            case "NEURAL BINARY - DO NOT ALTER":
                saveVersionMessage = "packed data format";
            case "NEURAL BINARY STRING - DO NOT ALTER":
                decodedSave = LZString.decompressFromBase64(saveData)
                saveVersionMessage = saveVersionMessage || "string data format";
            break

            case "v1":
                decodedSave = decodeURIComponent(atob(saveData))
                saveVersionMessage = "legacy data format"
            break

            default:
                decodedSave = atob(saveData)
                saveVersionMessage = "beta data format"
        }

        if(decodedSave == null) {
            printError('this save file is corrupt! plz email fiend@corru.works about it and send the save too just in case', "verbatim")
            throw 'save load error'
        }

        flags = JSON.parse(decodedSave)

        if(flags.modList) {
            env.intermediateLoadHold = (loadModsChoice) => {
                if(!loadModsChoice) {
                    delete flags.modList
                }

                mountFlags(flags, "modded " + saveVersionMessage, reload)
            }

            document.body.insertAdjacentHTML('beforeend', `
                <div id="mod-warning" class="popup-warning">
                    <div class="sysblock">
                        <div class="sysbox">
                            <h3>!!__WARNING__!!</h3>
                            <p class="sysinfo">Imported save contains the following auto-loading modifications:</p>
                            <p style="white-space: pre-wrap;overflow: auto;max-width: 100%;max-height: 200px;">${flags.modList}</p>
                            <p class="sysinfo">Remove prior to import?</p>
                            <p class="sysinfo">Please note that some modded data may persist if the log has been heavily altered.</p>
                            <div class="buttons">
                                <span id="gpu-done" class="button" onclick="env.intermediateLoadHold(false);document.querySelector('#mod-warning').remove()">remove them</span>
                                <span id="gpu-hide" class="button" onclick="env.intermediateLoadHold(true);document.querySelector('#gpu-warning').remove()">keep them</span>
                            </div>
                        </div>
                    </div>
                </div>
            `)

        } else mountFlags(flags, saveVersionMessage, reload)

    } catch(e) {
        readoutAdd({message: `ERROR::'data format invalid';'unable to process'`, name:"sys"})
        console.log(e)
    }
}

function mountFlags(flags, saveVersionMessage, reload) {
    localStorage.setItem('flags', JSON.stringify(flags))
    sessionStorage.clear()

    exitMenu()

    readoutAdd({message: `NOTE::'data imported';'${saveVersionMessage}'`, name:"sys"})
    
    if(reload) {
        //transition out
        flash(true);cutscene(true);MUI('off');
        if(env.bgm) env.bgm.fade(env.bgm.volume(), 0, 1000)
        corruStatic.play()
        corruStatic.fade(0, 0.5, 1000)

        setTimeout(()=>{
            readoutAdd({message: `ALERT::RELOADING::...'`, name:"sys"})
        }, 1500)
        
        setTimeout(()=>{
            location.replace('/')
        }, 3000)
    }

}

function downloadSave() {
    const fullEncode = LZString.compressToBase64(JSON.stringify(flags))

    let saveEncode = "NEURAL BINARY - DO NOT ALTER::"
    saveEncode += fullEncode
    saveEncode += "::END NEURAL BINARY"

    const blobURL = URL.createObjectURL(new Blob([saveEncode], { type: 'text/plain' }));
    download(blobURL, `save.corru`)
    setTimeout(()=>URL.revokeObjectURL(blobURL), 20) // apparently good practice
    
    readoutAdd({message: `NOTE::'data exported as file'`, name:"sys"})
}

// generic downloader (intended for use with save download)
function download(thingURL, fileName) {
    play('muiScanner', 1.25)
    
    //add DL element
    const downloadLink = document.createElement('a');
    downloadLink.href = thingURL;
    downloadLink.target = "_blank";
    downloadLink.download = fileName;
    downloadLink.setAttribute("data-no-swup", true);
    downloadLink.style.display = 'none';
    
    //trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// save uploader
// has to take a file input event
function uploadSave(ev) {
    play('muiScanner', 1.5)
    const file = ev.target.files[0]

    const reader = new FileReader()
    reader.onload = function(e) {
        mountSave(e.target.result)
    }

    reader.readAsText(file)
}

//loading mechanism to be used in onLoaded - adds scripts and styles IN ORDER of the array given
function addResources(resList, i = 0) {
    env.loading = true; body.classList.add('loading')
    if(i == resList.length) {
        body.classList.remove('loading')
        setTimeout(()=>document.dispatchEvent(new CustomEvent('corru_resources_added', { detail: { resList } })), 500)
        return env.loading = false 
    }

    let res = resList[i]
    let resEl

    //if array, may have a 'showif' type exec and skip loading this resource
    //useful in case of classes
    if(typeof res == "object") {
        if(typeof res[1] == "function") {
            if(!res[1]()) return addResources(resList, i+1);
            res = res[0]
        }
    }

    console.log(res)

    if(res.includes(".js")) { //script
        resEl = document.createElement('script')
        resEl.src = `${res}?v=${page.cacheval}`

    } else if(res.includes(".css")) { //style
        resEl = document.createElement('link')
        resEl.href = `${res}?v=${page.cacheval}`
        resEl.rel = "stylesheet"
        resEl.type = "text/css"
    } else { 
        body.classList.remove("loading")
        printError(`unable to load resource ${res}, wrong type`, true)
    }
    
    content.appendChild(resEl)
    resEl.onload = ()=>addResources(resList, i+1)
    resEl.onerror = (er)=>{
        addResources(resList, i+1)
        printError(`unable to load resource ${res}, check F12 console for specific issue (most likely cross origin headers failure though)`, true)
    }
}

//progress & event tracking shortcuts
function change(key, value) {
    var flagpool = flags
    if(key.includes("TEMP!!")) flagpool = sessionStorage
    if(key.includes("PAGE!!")) flagpool = page.flags

    switch(value) {
        case "++":
            if(!flagpool[key]) flagpool[key] = 1
            else flagpool[key] = Number(flagpool[key]) + 1
        break

        case "--":
            if(!flagpool[key]) flagpool[key] = -1
            else flagpool[key] = Number(flagpool[key]) - 1
        break

        case "DELETE":
            delete flagpool[key]
        break

        case "TOGGLE":
            flagpool[key] = !flagpool[key]
        break

        default:
            flagpool[key] = value
    }

    updateFlags()
    checkEpisodeProgress()

    // Dispatch the change event
    document.dispatchEvent(new CustomEvent('corru_changed', { detail: { key, value } }));
}

function updateFlags() {
    localStorage.setItem('flags', JSON.stringify(flags))
}

//basic flag lookup - this just checks against the flags object, or something within it
// [keyname]                - regular key, top level
// [dialogue]__[keyname]    - dialogue key - having __ swaps flagpool to look in seen dialogues instead
// exm|[pathname]|[entname] - checks to see if you've scanned the given ent in the specified location - pathname can be part of a URL rather than the whole one, (i.e. "local" to check in all /local/ areas). ALSO, slashes are ignored from target (i.e. localdullvessel, no /)
function check(inputKey, inputValue = null) {
    let key = inputKey	
    let value = inputValue

    //i.e. ('netstat|>=', 0), or just ('netstat|#') or ('netstat|') for status
    if(key.startsWith('netstat|')) { //checking network status. will check a 'fakenet' var beforehand, which takes precedence over gmss
        let query = key.split('|')
        let queryCode = value === 0 || value ? Number(value) : false // this is NaN if it's not a number (surprise)
        let comparison = query[1]
        let currentCode = Number(typeof env.fakenet == 'number' ? env.fakenet : env.mss.code)

        if(typeof queryCode == "number") {
            switch(comparison) {
                case ">": case "gt":  return currentCode > queryCode
                case "<": case "lt":  return currentCode < queryCode
                case ">=": case "gte": return currentCode >= queryCode
                case "<=": case "lte": return currentCode <= queryCode
                default:    return currentCode == queryCode
            } 
        } else return currentCode

    } else if(key.includes('exm|')) {  //checking to see if an ent is scanned
        let query = key.split('|')
        let targetLocation = query[1]
        let targetEntity = query[2]
        var foundEntity = false

        //runs through pages until it finds at least one page with the specified entity, then breaks
        for (const pageName in flags.detectedEntities) {
            const page = flags.detectedEntities[pageName];
            let strippedPath = page.path.replace(/[/]/g, '');

            if(strippedPath.includes(targetLocation)) {
                let entity = page.entities[targetEntity]
                if(entity) if(entity.scanned) foundEntity = true
            }
        }

        if(value === true)          return foundEntity == true
        else if(value === false)    return foundEntity == false
        else                        return foundEntity

    } else if(key.includes('pa|')) { //checking to see if someone is timestopper'd in the page.party object
        if(!page.party) return 'no party'
        let query = key.split('|')
        let partyLimit = page.party.partyLimit || 3
        let present = page.party.slice(0, partyLimit).some(mem => mem.slug === query[1])

        if(value === true)          return present == true
        else if(value === false)    return present == false
        else                        return present

    } else if(key.includes('aug|')) { //checks to see if augment is in use by anyone in party
        let query = key.split('|')
        if(!page.party) return 'no party'
        let usingAugment = page.party.some(member=>{
            if(member.augments) return member.augments.includes(query[1])
        })

        if(value === true)          return usingAugment == true
        else if(value === false)    return usingAugment == false
        else                        return usingAugment

    } else if(key.includes('item|')) { //checking to see if an item is in the party inventory
        //item|name|gt, #   greater than
        //item|name|lt, #   less than
        //item|name|gte, #   greater than/equal
        //item|name|lte, #   less than/equal
        //item|name, #      equals
        //item|name, false  has none    
        //item|name, true   has any     
        //item|name, (none) has any     

        let query = key.split('|')
        let itemCheck = checkItem(env.ITEM_LIST[query[1]])
        let comparison = query.length > 2 ? query[2] : false

        if(typeof value == "number") {
            switch(comparison) {
                case ">": case "gt":  return itemCheck > value
                case "<": case "lt":  return itemCheck < value
                case ">=": case "gte": return itemCheck >= value
                case "<=": case "lte": return itemCheck <= value
                default:    return itemCheck == value
            } 
        }

        else if(value === false)    return itemCheck == 0
        else                        return itemCheck > 0

    } else { //checking for regular flag
        let flagPool = flags
        if(key.includes("ENV!!")) {flagPool = env; key = key.replace("ENV!!", '')} //ENV!! is the session/page environment, it gathers content as you go through different areas and contains almost everything
        if(key.includes("TEMP!!")) flagPool = sessionStorage //TEMP!! is per session
        if(key.includes("PAGE!!")) flagPool = page.flags //PAGE!! is per page
        if(key.includes('__') || key.includes('++')) { //__/++ indicates dialogue related, ++ is global
            flagPool = flags.dialogues
            if(!key.includes('-')) key = key + "-start" //if you're checking the general name of the dialogue, check the start visibility instead
        }

        let returnVal
        if(typeof flagPool[key] == "undefined") { //it's undefined
            if(value === null || value === true) returnVal = false
            else if(value == false) returnVal = true
        } else { //it's defined
            if(flagPool[key] === value) { // basic comparison
                returnVal = true

            } else if(flagPool[key] && value === null) { //regular get
                returnVal = flagPool[key] == "false" ? false : flagPool[key]
                
            } else if(value === true) { //checking for truthiness
                if(flagPool[key] != "false" && flagPool[key]) returnVal = true;
                else returnVal = false

            } else if(value === false && (flagPool[key] == false || flagPool[key] == "false")) { //checking for falsiness
                returnVal = true

            } else { //fallback
                returnVal = false
            }
        }

        return returnVal
    }
}

//sort of like check, but takes either a string, array, or 2d array of CHECK conditions (or EXECs)
//this is used to check if all of the "showIf" conditions are true - primarily in dialogue, but also in stage locks
function getShowValidity(showIf, execArg) {
    if(typeof showIf == "undefined") return true

    var conditions = []

    if(typeof showIf == 'function') {
        //console.log('func, attempting with:', execArg)
        conditions.push(showIf(execArg))

    } else {
        //evaluates 2d array, [[key, val], [key, val]]
        //we do some standardizing since showIfs can come in a few forms
        showIf = upgradeShowIf(showIf)

        showIf.forEach(flag => {
            if(flag[0].startsWith('EXEC::')) { //this means that the flag in question is an exec string, so execute it and put the return in conditions
                conditions.push(Function(`return ${flag[0].replace('EXEC::', '')}`)())
            } else {
                if(flag.length == 1) conditions.push(check(flag[0]))
                else conditions.push(check(flag[0], flag[1]))
            }
        })
    }

    //returns a check of if all conditions are true - .every(boolean) returns true if everything is truthy
    //console.log(conditions)
    return conditions.every(Boolean)
}

//'upgrades' a 'showIf' object to be its most verbose form ([[thing], [thing, true]])
//this undoes shorthands used across showIf and lets us expect a standard 'shape' when using getShowValidity
function upgradeShowIf(showIf) {
    let newShowIf = showIf

    if(Array.isArray(showIf)) {
        if(Array.isArray(showIf[0])) return showIf //no changes needed
        else newShowIf = [showIf] //simple upgrade to 2D needed
    } else if(typeof showIf == "string") {
        newShowIf = [[showIf]] //ditto
        //if it's a string, it's either an EXEC:: string or a regular string
        //so this can just be wrapped in two arrays
    }

    return newShowIf
}

//changes env.bgm to the specified new bgm, storing the old as env.oldBgm
function changeBgm(newBgm, {length = 1000, preserve = true, rate = false, seek = false, pause = false} = {}) {
    if(env.bgm == newBgm || env.stopBgmChanges) return

    console.log("changing to", newBgm)
    try {
        let oldBgm = env.bgm
        oldBgm.fade(env.bgm.volume(), 0, length);
        setTimeout(()=>{
            if(env.bgm == oldBgm) return;
            if(pause) oldBgm.pause()
            else if(oldBgm.playing()) oldBgm.stop()
        }, length)
        
        if(preserve) { 
            env.oldBgm = oldBgm
            env.oldBgm.saveRate = oldBgm.rate()
        }
    
        env.bgm = newBgm
        if(rate) env.bgm.rate(rate)
        if(seek) env.bgm.seek(seek)
        env.bgm.volume(0)
        env.bgm.play()
        env.bgmIsFading = true
        env.bgm.on('fade', ()=> {if(env.bgm) env.bgmIsFading = false}) //on fade completion
        env.bgm.fade(0, getModifiedVolume('music', env.bgm.intendedVol ? env.bgm.intendedVol : 1), length);
    } catch(e) { printError(e) }
}

//reverts env.bgm to the last saved env.oldBgm, then clears oldBgm
function revertBgm(length = 1000) {
    if(!env.oldBgm || env.stopBgmChanges) return
    changeBgm(env.oldBgm, {length: length, pause: true, preserve: false, rate: env.oldBgm.saveRate || 1})
    env.oldBgm = false
}

//distinct from changing music, since this pauses the old one instead
//despite the name it won't actually turn off the music at this time
//i mostly use this for handling what song an area should have
function toggleBgm(song, preserve = false) {
    if(!song || song == env.bgm || env.stopBgmChanges) return
    console.log("reverting from", song)

    if(!song.playing()) {
        let oldBgm = env.bgm
        env.bgm = song
        
        if(preserve) { 
            env.oldBgm = oldBgm
            env.oldBgm.saveRate = oldBgm.rate()
        }

        if(env.bgm.intendedRate) env.bgm.rate(env.bgm.intendedRate)
        env.bgm.volume(0)
        env.bgm.play()
        env.bgm.fade(0, getModifiedVolume('music', env.bgm.intendedVol ? env.bgm.intendedVol : 1), 400)
        oldBgm.fade(oldBgm.volume(), 0, 400)
        setTimeout(()=>oldBgm.pause(), 400)
    }
}

//adjusts based on the group volume
/* groups are:
    - sfx (localStorage['volume-sfx'])
    - music (localStorage['volume-music'])
*/
function getModifiedVolume(type, desiredVol) {
    let groupVol = localStorage[`volume-${type}`] || 1
    return desiredVol * groupVol    
}

//basic slugify function to make json-friendly names, this is from some stack overflow somewhere
function slugify(str) {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();
  
    // remove accents, swap Ã± for n, etc
    var from = "Ã Ã¡Ã¤Ã¢Ã¨Ã©Ã«ÃªÃ¬Ã­Ã¯Ã®Ã²Ã³Ã¶Ã´Ã¹ÃºÃ¼Ã»Ã±Ã§Â·/_,:;";
    var to   = "aaaaeeeeiiiioooouuuunc------";
    for (var i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '_') // collapse whitespace and replace by -
        .replace(/-+/g, '_'); // collapse dashes

    return str;
}    

function round(x, to) {
    return Math.round(x / to) * to
}

//page change shortcut
function moveTo(destUrl, closeMui = true, ignoreLoadPreference = false){
    if(closeMui) {
        MUI("off")
        MUI("deprohibit")
        if(body.classList.contains('in-dialogue')) endDialogue()
    }

    env.waitOnLoadIgnore = ignoreLoadPreference
    swup.loadPage({url: destUrl})
}

//commit page die to help performance during long sessions
function corruRefresh(destination, delay = 5000) {
    body.classList.add('corru-refreshing')
    body.setAttribute('state', 'corru-leaving')
    
    change("TEMP!!sat", true) // just in case they ?force'd in, this would otherwise break stuff
    
    if(env.bgm) {
        env.bgmIsFading = true
        env.bgm.fade(env.bgm.volume(), 0, 4000)
    }

    MUI('off'); MUI('prohibit');flash(true); cutscene(true); exitMenu();
    
    if(!destination) {
        readoutAdd({message: `ATTENTION::'data processing complete';'refreshing local memory'`, name:"sys"})
    }

    setTimeout(()=>{play("status", 0.3)}, 1000)
    setTimeout(()=>{
        if(destination) window.top.location = destination
        else window.top.location=window.top.location
    }, delay)
}

//VFX/overlay manager
//type is a string, i.e. "flash", "velzieflash"
function vfx({type, state, delay = 0, cutscene: useCutscene = null, callback = false}) {
    setTimeout(()=>{
        switch(type) {
            //grandfathered in old vfx commands
            case "flash":
                flash(state)
            break

            case "velzieflash":
                flash(state, state)
            break

            case "beacon":
                let beacon = body.querySelector('#beacon-vfx')

                if(state && !beacon) {
                    body.insertAdjacentHTML(`beforeend`, `<div id="beacon-vfx" class="vfx"></div>`)

                    beacon = body.querySelector('#beacon-vfx')
                    setTimeout(()=>beacon.classList.add('active'), 100)
                } else if(beacon) {
                    //fade and remove
                    beacon.classList.remove('active')
                    setTimeout(()=>beacon.remove(), 800)
                }
            break

            case "okidoia":
                let okidoki = body.querySelector('#beacon-vfx')

                if(state && !okidoki) {
                    body.insertAdjacentHTML(`beforeend`, `<div id="beacon-vfx" class="vfx okidoia"></div>`)

                    okidoki = body.querySelector('#beacon-vfx')
                    setTimeout(()=>okidoki.classList.add('active'), 100)
                } else if(okidoki) {
                    //fade and remove
                    okidoki.classList.remove('active')
                    setTimeout(()=>okidoki.remove(), 800)
                }
            break

            case "skip":
                if(!env.skipscreen) {
                    body.insertAdjacentHTML(`beforeend`,`<div id="skip-vfx" class="vfx"></div>`)
                    env.skipscreen = body.querySelector("#skip-vfx")
                }

                if(state) {
                    env.skipscreen.classList.add('active')
                    body.classList.add('active-skipping')
                } else {
                    env.skipscreen.classList.remove('active')
                    body.classList.remove('active-skipping')
                }
            break
        }

        if(useCutscene === true || useCutscene === false) cutscene(useCutscene)
        if(callback) callback()
    }, delay)
}

//preloading assets that are about to be used
function imagePreload(input) {
    const urls = Array.isArray(input) ? input : [input]
    urls.forEach(url => {
        const img = new Image()
        img.src = url
    })
}

//legacy quick transition toggle - use VFX instead of this
function flash(state, velzie = false) {
    switch(state) {
        case true:
            if(velzie) body.classList.add('flash', 'velzie')
            else { body.classList.add('flash'); body.classList.remove('velzie') }
        break
        case false:
            body.classList.remove('flash', 'velzie')
        break
    }
}

//basic rand
function rand(min, max) {
    if(typeof min == "object") {
        //can take 2-length array instead of two values
        return Math.floor(Math.random() * (min[1] - min[0]) + min[0]);
    } else {
        if(!max) return min;
        return Math.floor(Math.random() * (max - min) + min);
    }
}

//weighted rand
/* takes weights i.e.: 
    [
        [(thing), # weight],
        ...
    ]
*/
function weightRand(weightedArray) {
    let totalWeight = 0

    //collect total weight
    for (const [thing, weight] of weightedArray) { totalWeight += weight }

    //do roll
    let roll = Math.random() * totalWeight
    let currentWeight = 0
    for (const [thing, weight] of weightedArray) {
        currentWeight += weight
        if (roll <= currentWeight) return thing
    }
}

//easy async wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//array shuffle from https://stackoverflow.com/a/46545530
function shuffle(array) {
    return array.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
}

/* AUDIO */
//static cuz we always use it
var corruStatic = new Howl({
	src: ['/audio/static.ogg'],
	preload: true,
	loop: true,
    volume: 0.4,
	sprite: {
		__default: [1000, 13000, true]
	}
});

//global SFX map
var sfxmap = new Howl({
    src: ['/audio/csfxmap.ogg'],
    preload: true,
    html5: false,
    volume: 0.75,
    sprite: {
        talk1: [0, 1000],
        talk2: [1000, 1000],
        talk3: [2000, 1000],
        talk4: [3000, 1000],
        talk5: [4000, 1000],
        talk6: [5000, 1000],
        talk7: [6000, 1000],
        talk8: [7000, 1000],
        muiToggle: [8000, 1000],
        muiScanner: [9000, 1000],
        muiReadout: [10000, 1000],
        muiHover: [11000, 1000],
        muiClick: [12000, 1000],
        criticalError: [13000, 11000],
        talkhigh1: [24000, 1000],
        talkhigh2: [25000, 1000],
        talkhigh3: [26000, 1000],
        talkhigh4: [27000, 1000],
        talkhigh5: [28000, 1000],
        talkhigh6: [29000, 1000],
        talkhigh7: [30000, 1000],
        talkhigh8: [31000, 1000],
        talklaugh1: [32000, 1000],
        talklaugh2: [33000, 1000],
        talklaugh3: [34000, 1000],
        talklaugh4: [35000, 1000],
        talklaugh5: [36000, 1000],
        talklaugh6: [37000, 1000],
        talklaugh7: [38000, 1000],
        talklaugh8: [39000, 1000],
        talksignal1: [40000, 1000],
        talksignal2: [41000, 1000],
        talksignal3: [42000, 1000],
        talksignal4: [43000, 1000],
        talksignal5: [44000, 1000],
        talksignal6: [45000, 1000],
        talksignal7: [46000, 1000],
        talksignal8: [47000, 1000],
        hit: [48000, 1000],
        miss: [49000, 1000],
        crit: [50000, 1000],
        chomp: [51000, 1000],
        stab: [52000, 1000],
        status: [54000, 2000],
        shot1: [56000, 1000],
        shot2: [58000, 1500],
        shot3: [60000, 1000],
        shot4: [62000, 1500],
        shot5: [66000, 1500],
        shot6: [68000, 2000],
        click1: [70000, 250],
        click2: [70250, 500],
        destabilize: [72000, 2000],
        mend: [74000, 2000],
        talkcore1: [76000, 1000],
        talkcore2: [77000, 1000],
        talkcore3: [78000, 1000],
        talkcore4: [79000, 1000],
        talkcore5: [80000, 1000],
        talkcore6: [81000, 1000],
        talkcore7: [82000, 1000],
        talkcore8: [83000, 1000],
        talkgal1: [84000, 1000],
        talkgal2: [85000, 1000],
        talkgal3: [86000, 1000],
        talkgal4: [87000, 1000],
        talkgal5: [88000, 1000],
        talkgal6: [89000, 1000],
        talkgal7: [90000, 1000],
        talkgal8: [91000, 1000],
        fear: [92000, 2000],
        guard: [94000, 2000],
        dull: [96000, 3000],
        obeskClick: [100000, 1000],
        obeskHover: [101000, 1000],
        obeskToggle: [102000, 2000],
        talkgel1: [104000, 1000],
        talkgel2: [105000, 1000],
        talkgel3: [106000, 1000],
        talkgel4: [107000, 1000],
        talkgel5: [108000, 1000],
        talkgel6: [109000, 1000],
        talkgel7: [110000, 1000],
        talkgel8: [111000, 1000],
        unitymask: [112000, 4000],
        realitymask: [116000, 5000],
        hungermask: [124000, 5000],
        talkcroak1: [132000, 1000],
        talkcroak2: [133000, 1000],
        talkcroak3: [134000, 1000],
        talkcroak4: [135000, 1000],
        talkcroak5: [136000, 1000],
        talkcroak6: [137000, 1000],
        talkcroak7: [138000, 1000],
        talkcroak8: [139000, 1000],
        talkchoir1: [140000, 2000],
        talkchoir2: [142000, 2000],
        talkchoir3: [144000, 2000],
        talkchoir4: [146000, 2000],
        talkchoir5: [148000, 2000],
        talkchoir6: [150000, 2000],
        talkchoir7: [152000, 2000],
        talkchoir8: [154000, 2000],
        talkflower1: [156000, 1000],
        talkflower2: [157000, 1000],
        talkflower3: [158000, 1000],
        talkflower4: [159000, 1000],
        talkflower5: [160000, 1000],
        talkflower6: [161000, 1000],
        talkflower7: [162000, 1000],
        talkflower8: [163000, 1000],
        talkfloweralt1: [164000, 1000],
        talkfloweralt2: [165000, 1000],
        talkfloweralt3: [166000, 1000],
        talkfloweralt4: [167000, 1000],
        talkfairy1: [168000, 1000],
        talkfairy2: [169000, 1000],
        talkfairy3: [170000, 1000],
        talkfairy4: [171000, 1000],
        talkfairy5: [172000, 1000],
        talkfairy6: [173000, 1000],
        talkfairy7: [174000, 1000],
        talkfairy8: [175000, 1000],
        talkmind1: [176000, 1000],
        talkmind2: [177000, 1000],
        talkmind3: [178000, 1000],
        talkmind4: [179000, 1000],
        talkmind5: [180000, 1000],
        talkmind6: [181000, 1000],
        talkmind7: [182000, 1000],
        talkmind8: [183000, 1000],
        okidoia1: [184000, 2000],
        okidoia2: [186000, 2000],
        okidoia3: [188000, 2000],
        okidoia4: [190000, 2000],
        scarydoia1: [192000, 2000],
        scarydoia2: [194000, 2000],
        scarydoia3: [196000, 2000],
        scarydoia4: [198000, 2000],
        laser: [200000, 4000],
        weirdbuild: [204000, 4000],
        bingbong: [208000, 4000],
        megastatus: [212000, 4000],
        __default: [0, 1]
    }
});

//general function for playing from the SFXmap
//we drop the volume of the bgm slightly when playing something
env.recentSfx = false
function play(sfxName, pitch = true, volume = 0.75, forcePlay) {
    if(forcePlay) env.recentSfx = false    
    if(env.recentSfx || env.noSfx) return
    env.recentSfx = true
    
    //we may change this depending on the SFX played
    var sfx = sfxName
    
    //randomize the pitch slightly by default
    if(pitch === true) {
        sfxmap.rate((Math.random() * 0.2) + 0.9) 
    } else if(pitch == "inherit") {
         //don't do anything, just go with the flow
    } else if(typeof pitch == "number") { //set the pitch if specified
        sfxmap.rate(pitch)
    } else { //otherwise false
        sfxmap.rate(1)
    }

    //if this uses a talk sound, we randomly select one of eight
    switch(sfxName) {
        case "talk": sfx = `talk${rand(1, 9)}`; break
        case "talkhigh": sfx = `talkhigh${rand(1, 9)}`; break
        case "talklaugh": sfx = `talklaugh${rand(1, 9)}`; break
        case "talksignal": sfx = `talksignal${rand(1, 9)}`; break
        case "talkcore": sfx = `talkcore${rand(1, 9)}`; break
        case "talkgal": sfx = `talkgal${rand(1, 9)}`; break
        case "talkgel": sfx = `talkgel${rand(1, 9)}`; break
        case "talkcroak": sfx = `talkcroak${rand(1, 9)}`; break
        case "talkchoir": sfx = `talkchoir${rand(1, 9)}`; break
        case "talkflower": sfx = `talkflower${rand(1, 9)}`; break
        case "talkfloweralt": sfx = `talkfloweralt${rand(1, 5)}`; break
        case "talkfairy": sfx = `talkfairy${rand(1, 9)}`; break
        case "talkmind": sfx = `talkmind${rand(1, 9)}`; break
        case "okidoia": sfx = `okidoia${rand(1, 5)}`; break
        case "scarydoia": sfx = `scarydoia${rand(1, 5)}`; break
        //shot also has a variety
        case "shot": sfx = `shot${rand(1, 7)}`; break
    }

    //duck the BGM briefly so the SFX doesn't layer with it too hard
    //also adjusts the amount by which we duck proportionally to the loudness of SFX
    if(env.bgm && !env.bgmIsFading && !env.noBgmDuck && localStorage['volume-sfx'] !== "0") {
        let intended = getModifiedVolume('music', env.bgm.intendedVol ? env.bgm.intendedVol : 1)
        let duckAmt = 1 - (isFinite(localStorage['volume-sfx']) ? (localStorage['volume-sfx'] * 0.5) : 0.5)
        env.bgm.volume(intended * duckAmt)
        setTimeout(()=>{ try{env.bgm.fade(intended * duckAmt, intended, 500)} catch(e) {} }, 500)
    }
    
    //play!
    setTimeout(()=>env.recentSfx = false, 50)
    sfxmap.volume(getModifiedVolume('sfx', volume))
    sfxmap.play(sfx)
}

function forcePlay(sfxName, pitch, volume) { 
    let haltingSfx = env.noSfx
    env.recentSfx = false
    env.noSfx = false
    play(sfxName, pitch, volume)
    if(haltingSfx) env.noSfx = haltingSfx
}

/* ratween - rough rate tweening using howler and some timeouts */
function ratween(howl, desiredRate, duration = 1000) {
    if(!desiredRate) return console.warn(`got passed ${desiredRate} in ratween, invalid! howl:`, howl);
    try {
        //we keep track of a currentRatween in case multiple ratweens are in effect at the same time
        env.ratweenCount = (env.ratweenCount + 1) || 1
        let currentRatween = env.ratweenCount

        let startingRate = howl.rate()
        if(startingRate == desiredRate) return

        //split the duration into 50ms chunks and execute them
        let stepLength = 50
        let steps = duration / stepLength
        for (let i = 1; i < (steps + 1); i++) {
            setTimeout(()=>{
                if(env.ratweenCount == currentRatween) howl.rate(startingRate + ((i/steps) * (desiredRate - startingRate)) || 1)
            }, stepLength * i)
        }
    } catch(e) { printError(e) }
}

/** terrible practice area **/
//add random extension to Array
//you can tell it to not use the same value as the last time, if that's possible
Array.prototype.sample = function({noRepeat, remove} = {noRepeat: false, remove: false}){
    let value = rand(0, this.length)

    if(noRepeat && this.length > 1) while(value == this.lastSampleValue) value = rand(0, this.length)
    this.lastSampleValue = value

    if(remove) return this.splice(value, 1)[0];
    return this[value];
}

//get angle between two points
function calculateAngle(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.atan2(dy, dx) * (180 / Math.PI);
}

//since ff windows has a major css processing issue
function isFirefoxOnWindows() {
    return navigator.userAgent.indexOf('Firefox') !== -1 && navigator.userAgent.indexOf('Windows') !== -1;
}

/* polyfills */
/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(str, newStr){

        // If a regex pattern
        if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
            return this.replace(str, newStr);
        }

        // If a string
        return this.replace(new RegExp(str, 'g'), newStr);

    };
}

//simple 'keep number in range' solution
if(!Math.clamp) {
    Math.clamp = (number, min, max) => {
        return Math.max(min, Math.min(number, max));
    }
}

/* SPECIAL NETWORK CALLS OR CHECKS DONE AFTER LOADING */
//??? wa da he
async function gmss() {
    let mss = {
        state: 0.5,
        status: "coherent",
        code: 0
    }

    await fetch("https://state.corru.network/").then(response => response.json()).then(json=> {if(check("ENV!!ep2")) mss = json})

    document.querySelectorAll('.mindsci-status').forEach(el=>{
        el.setAttribute('state', mss.state)
        el.setAttribute('status', mss.status)
        el.setAttribute('code', mss.code)
        el.setAttribute('definition', `GAD::'${mss.status}'`)
    })

    let oldCode = env.mss ? env.mss.code : -99
    env.mss = mss

    if((typeof env.fakenet != 'number' && mss.code != oldCode) || oldCode == -99) updateCode()
}

function updateCode() { 
    let num = typeof env.fakenet == 'number' ? env.fakenet : env.mss.code
    body.setAttribute('c', num ) 

    switch(num) { //for specific states, use 'c' instead of 'n' - 'n' is a general ordering
        case -2: case -1: body.setAttribute('n', 'i'); break
        case 0: body.setAttribute('n', 'c'); break
        case 2: case 1: body.setAttribute('n', 'o'); break
    }
    
    env.effectiveNet = num
    document.dispatchEvent(new CustomEvent('corru_net'));
}

gmss()
setInterval(gmss, 300000)

//GPU detection - this is done to show an alert to turn on acceleration
function runGPUCheck(){
    DetectGPU.getGPUTier().then(res => {
        if(res.type == "FALLBACK") { //if this result happens, it means hardware acceleration is off (or they don't have a GPU... frightening thought)
            if(!check('ignoregpu')) {
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="gpu-warning" class="popup-warning">
                        <div class="sysblock">
                            <div class="sysbox">
                                <h3>!!__WARNING__!!</h3>
                                <p class="sysinfo">Realtime log and memory rendering requires GPU hardware acceleration. Performance suggests this may presently be disabled. Proceeding without resolving this issue will most likely result in pain.</p>
                                <p class="sysinfo">To enable hardware acceleration, enter your viewer settings, search for "hardware", "acceleration", or find it in the performance/system section, and toggle it on. A restart of the viewer may be necessary.</p>
                                <div class="buttons">
                                    <span id="gpu-done" class="button" onclick="document.querySelector('#gpu-warning').remove()">i fixed it</span>
                                    <span id="gpu-hide" class="button" onclick="javascript:change('ignoregpu',true);document.querySelector('#gpu-warning').remove()">i don't care</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `)
            }
        }
    })
}

//widescreen detection - just a friendly "hey i don't make this for big screens sorry lol"
function nonStandardScreenCheck(){
    if(location.search.includes("?noadapt")) {
        change("widegamer", true)
        location.replace(location.href.replace("noadapt", ""))
        return
    }

    //standard checks - warn if needed, apply adapter if already accepted
    if(
        (window.innerHeight > 1100 || window.innerWidth > 2000) &&
        !check("widegamer") &&
        !location.search.includes('wide')
    ) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="wide-warning" class="popup-warning">
                <div class="sysblock">
                    <div class="sysbox">
                        <h3>!!__WARNING__!!</h3>
                        <p class="sysinfo">Your neural output (${window.innerWidth}x${window.innerHeight}) is currently larger than 1920x1080. Use of a size-limiting adapter is recommended and may be toggled in the SYS menu.</p>
                        <p class="sysinfo">You may proceed with this output size, but this is larger than the available input, and you may experience unusual visual or mechanical artifacts.</p>
                        <div class="buttons">
                            <span id="wide-done" class="button" onclick="change('widegamer', 'adapter');nonStandardScreenCheck()">activate adapter</span>
                            <span id="wide-hide" class="button" onclick="change('widegamer', 'true');document.querySelector('#wide-warning').remove()">i don't care</span>
                        </div>
                    </div>
                </div>
            </div>
        `)
    } else if(check("widegamer", "adapter") && !location.search.includes('wide')) {
        location.replace(`/widescreen/?path=${location.pathname + location.search}`)
    }

    if(location.search.includes('wide')) {
        body.setAttribute('wide', 'adapted')
    } else {
        body.setAttribute('wide', 'false')
    }
}

function mothHasUnreadCheck() {
    if(body.getAttribute("state") != "corru-entered") return;

	let baseCheck = checkUnread({destination: "start", arbitrary: true}, "++mothglobal") 
	let pageCheck = typeof page.mothChat == "object" ? checkUnread({destination: "start", arbitrary: true}, page.mothChat.getDest()) : false

	body.querySelector(".moth-trigger").classList.toggle("newthoughts", Boolean(pageCheck || baseCheck))
}

/* 
    mask control
    simple methods for controlling active masks

    there's always a mask active (even default)
*/
function mask({name, retrigger = false, playSound = true}) {
    let current = check('mask') || "reality"
    let currentMask = env.masks[current]
    let newMask = env.masks[name]

    if(typeof newMask == "undefined") throw `bad mask detected - ${name}`
    if(playSound) {
        env.recentSfx = false
        sfxmap.stop()
        play(newMask.sound, true, 0.5)
    }

    change("mask", name)
    body.setAttribute('mask', name)
    if(current != name && typeof currentMask.off == "function") currentMask.off()
    if((current != name && typeof newMask.on == "function") || retrigger) newMask.on()
}

/* 
    string processing and localization 
*/

/* handles automatic definition injections */
// DOES NOT SUPPORT PHRASES WELL - only individual words
// additionally, some definitions will still be defined in-text since context matters
function processDefinitionsInString(input, {force = false} = {}) {
    if(!input) return input;
    if(!input.includes) return input;
    if ((input.includes('definition=') && input.includes("::")) && !force) return input; //if there's a manual definition, we want to skip this

    //we alter this string as it's processed to avoid definition overlaps
    let scanningInput = input
    let finalInput = input

    //initialize the page definitions with any translation overrides if it isn't already set up
    if(!page.formedDefinitionStrings) {
        const localization = getLocalizationForPage()
        page.formedDefinitionStrings = {...env.definitions, ...localization.definitions }
    }
    
    //we want to prioritize phrases over words
    const sortedDefinitions = Object.entries(page.formedDefinitionStrings).sort((a, b) => b[0].length - a[0].length)
    sortedDefinitions.forEach(([phrase, definition]) => {
        if(phrase.length > scanningInput.length) return;

        const type = (typeof definition === "object") ? definition.type || "INHERITED CONTEXT" : "INHERITED CONTEXT";
        const text = (typeof definition === "object") ? definition.text || definition : definition;

        if(phrase[0] == "Î¸") { //theta definitions are prefixed so that they can be immediately replaced without scanning
            //used mostly for special/context sensitive ones
            finalInput = finalInput.replaceAll(phrase, `<span class="definition" definition="${type}::${text.replace("Î¸", "").replace('"', "'")}">${phrase.replace("Î¸", "")}</span>`)

        } else {
            //this regex looks literally insane but it's a faster way of looking up phrases in the string
            //it also prepares them to be replaced if they're found by surrounding them with () and handling the escaping of any special characters
            const edgeStart = `(?<=\\s|^|[,.;:!?])`
            const edgeEnd = `(?=\\s|$|[,.;:!?])`
            const phraseRegex = new RegExp(`${edgeStart}(${phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})${edgeEnd}`, 'gi');

            // we check the scanningInput for matches
            while ((match = phraseRegex.exec(scanningInput)) !== null) {
                const replacement = `<span class="definition" definition="${type}::${text.replace("Î¸", "").replace('"', "'")}">${match[0]}</span>`;
                
                //replace the inputs - scanning to remove the match, finalInput to add the definition to the output
                scanningInput = scanningInput.replaceAll(match[0], "")

                //we do this to target replacements only outside of HTML
                finalInput = finalInput.replace(/\b(<[^>]*>|[^<]+)\b/g, (innerMatch)=>{
                    if(innerMatch.includes("definition") || innerMatch.startsWith("<")) {
                        return innerMatch
                    } 
                    else { return innerMatch.replace(new RegExp(match[0], 'g'), replacement) }
                })
            }
        }
    })
    
    return finalInput
}

env.localization = false // to be redefined in the event a localization file is loaded
/* 
    env.localization is an object that will be checked for various resources before anything else
    see /js/localization%20example.js for more details
*/

// almost identical to the definitions processing, this takes an untranslated string and checks it for matches within env.localization.strings
// could probably be the same function or at least not repeat so much, but fine for now
function processStringTranslation(input) {
    const localization = getLocalizationForPage()
    if(!localization.strings || !input) return input;
    
    //we alter this string as it's processed to avoid definition overlaps
    let scanningInput = input
    let finalInput = input
    
    //we want to prioritize phrases over words
    const sortedTranslations = Object.entries(localization.strings).sort((a, b) => b[0].length - a[0].length)
    sortedTranslations.forEach(([phrase, replacement]) => {
        if(phrase.length > scanningInput.length) return;

        //this regex looks literally insane but it's a faster way of looking up phrases in the string
        //it also prepares them to be replaced if they're found by surrounding them with () and handling the escaping of any special characters
        const phraseRegex = new RegExp(`(${phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');

        // we check the scanningInput for matches
        while ((match = phraseRegex.exec(scanningInput)) !== null || scanningInput == phrase) {
            const translated = replacement;
            
            // replace the inputs - scanning to remove the match, finalInput to add the definition to the output
            scanningInput = scanningInput.replaceAll(match[0], "")
            finalInput = finalInput.replaceAll(match[0], translated)
        }
    })
    
    return finalInput
}

// scans the page content and uses the above string translation for anything noted. shouldn't interfere with events and whatnot
// this should be set on an interval to tastes
function processTranslation(container, force = false) {
    if(!env.localization.strings) return;
    let outerEl = container || content

    outerEl.querySelectorAll(force ?" *" : "*:not(.tskip, .tdone, script, style)").forEach(el=>{
        //translates definition hover regardless of children since that's safe
        let def = el.getAttribute("definition")
        if(def) { el.setAttribute("definition", processStringTranslation(def)) }

        //same with entity
        let ent = el.getAttribute("entity")
        if(ent) { el.setAttribute("entaltname", processStringTranslation(ent))}

        // if something has child elements, we want to process its text nodes separately from its children
        // this is because the querySelectorAll already grabs everything - no need to traverse
        for (const childNode of el.childNodes) {
            if (childNode.nodeType === Node.TEXT_NODE) {
                if(childNode.textContent.trim().length == 0) continue; // skip if functionally whitespace
                childNode.textContent = processStringTranslation(childNode.textContent/*.trim()*/) // experimental trim remove - let's see what happens
            }
        }
        if(el.childNodes.length == 0) {console.log("skipped for", el); return el.classList.add('tskip')}
        el.classList.add("tdone")
    })
}

// combines top level and page level localization, compiling into the page object
// if this has already been done, just returns
// call "force" to update it
function getLocalizationForPage(force = false) {
    if(!env.localization) return false;
    if(!env.localization.page) return env.localization;
    if(!env.localization.page[page.dialoguePrefix]) return env.localization;
    if(page.localization && !force) return page.localization;
    console.log("hello", page.dialoguePrefix)

    page.localization = {}
    let keys = Object.keys(env.localization).concat(Object.keys(env.localization.page[page.dialoguePrefix]))

    for (var key of keys) {
        if(key == "page") continue;
        console.log("checking key", key)
        
        if (env.localization.hasOwnProperty(key) && env.localization.page[page.dialoguePrefix].hasOwnProperty(key)) {
            page.localization[key] = Object.assign({}, env.localization[key], env.localization.page[page.dialoguePrefix][key])
            console.log("combined")
        } else if(env.localization.hasOwnProperty(key)) {
            page.localization[key] = env.localization[key]
            console.log("base")
        } else if(env.localization.page[page.dialoguePrefix].hasOwnProperty(key)) {
            page.localization[key] = env.localization.page[page.dialoguePrefix][key]
            console.log("page")
        }
    }

    return page.localization;
}

if (
    !(
      window.location.hostname.endsWith("corru.observer") ||
      window.location.hostname === "localhost" ||
      window.location.hostname.endsWith("pages.dev") || //cloubflare....
      location.href.startsWith("app://") // don't ask
    )
) {
    window.location.href = "https://corru.observer";
}