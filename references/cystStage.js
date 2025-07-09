/*  handy spot locator
    var loc = document.querySelector('#creature');
    [... loc.parentElement.parentElement.children].indexOf(loc.parentElement)
*/

/* 
    "the" "stage" is a fragmented series of functions
    we've got a little bit of technical debt we're working through so please excuse the mess
    this could easily be class/object situation one day
*/

env.stageEntityNum = 0
function changeStage(targetStage, spot = false, direction = false, options = { duration: 400, noFlash: false, specificPlan: false }){
    if(!env.stages[targetStage]) { printError(`tried to go to a nonexistent stage "${targetStage}"`); throw `tried to go to a nonexistent stage "${targetStage}"`}
    body.classList.add('stage-transition')
    static.style.transitionDuration = `${options.duration}ms`

    if(!options.noFlash) {
        flash(true)
        MUI("off")
    }

    env.stage.enemyPause = true
    //console.log(`changing stage to ${targetStage}, target spot is ${spot}`);

    if(env.stages[targetStage].prerenderExec) env.stages[targetStage].prerenderExec()

    //transitions out before proceeding
    setTimeout(()=>{
        body.classList.remove('stage-active')
        //removes the old stage and updates the body styling
        if(env.stage.current) if(env.stage.current.leaveExec) env.stage.current.leaveExec()
        if(document.querySelector('.reference')) document.querySelector('.reference').remove()
        if(document.querySelector('#realgrid')) { 
            document.querySelector('#realgrid').remove()
        } else {
            //initializes if there was no grid before
            document.querySelector('.grid-plane').style.setProperty('--camera-rotation', "180")
            env.stage.justStepped = false;
            env.stage.lastMoved = "up";
            env.stage.moveDir = ['up', 'right', 'down', 'left']
        }

        body.id = targetStage
        let stage = env.stages[targetStage];

        //refgrid needs to generate based on the input stage
        var gridGen = ""

        if(options.specificPlan) stage.plan = stage.plans[options.specificPlan]; //requires that the stage has 'plans' in order to work
        //if a stage has a getPlan, it can have a dynamic configuration
        else if(typeof stage.getPlan == "function") stage.plan = stage.getPlan()
            
        //conversion to proper array, removing whitespace, etc
        if(typeof stage.plan == 'string') stage.plan = convertStagePlanStringToArray(stage.plan) 

        let plan = stage.plan        
        env.stage.stageW = stage.width
        env.stage.stageH = plan.length / env.stage.stageW

        plan.forEach(function(piece, i) {
            //look at the letter
            //if the letter exists in the stage entities, use that
            //if not, use default entities
            var pieceEntity = false

            if(stage.entities) {
                if(stage.entities[piece]) {
                    pieceEntity = stage.entities[piece];
                }
            }

            if(!pieceEntity) { pieceEntity = env.stageEntities[piece] }
            if(!pieceEntity) alert(`failed to find piece for ${piece}`)
            let pieceClass = `${pieceEntity.class || ""}`

            if(pieceEntity.contains) { if(pieceEntity.contains.dyp) {
                pieceClass += " dyp"
            }}
            
            pieceEntity.slug = piece
            let pos = stageCoordinatesFromIndex(i)

            if(pieceEntity.teleportTarget) { //you can either specify an examine entity, or contains, but not both. examineEntity is preferred
                let teleportProp = `
                    ${pieceEntity.examineEntity ? `<div class="target" ${pieceEntity.examinePriority ? `priority="${pieceEntity.examinePriority}"` : ''} entity="${pieceEntity.examineEntity}"></div>` : ""}
                    ${pieceEntity.contains ? generateStageEntityContents(pieceEntity, i) : ""}
                `.trim()

                gridGen += `
                    <div 
                        class="gridpiece blocks teleport locked ${pieceClass}" 
                        slug="${pieceEntity.slug ? pieceEntity.slug : piece}" 
                        spot="${(typeof pieceEntity.teleportSpot != 'undefined') ? pieceEntity.teleportSpot : false}" 
                        shouldFace="${(typeof pieceEntity.shouldFace != 'undefined') ? pieceEntity.shouldFace : false}" 
                        teleport-target="${pieceEntity.teleportTarget}" 
                        lockflag="${pieceEntity.lockFlag || ""}" 
                        lockexec="${pieceEntity.lockExec || ""}"
                        i="${i}"
                        style="--realX: ${pos.x}; --realY: ${pos.y}"
                        ${generateAttributes(pieceEntity)}
                    >${teleportProp}</div>
                `
            } else if(pieceEntity.contains) {
                gridGen += `
                    <div class="gridpiece ${pieceClass}" style="--realX: ${pos.x}; --realY: ${pos.y}" slug="${pieceEntity.slug ? pieceEntity.slug : piece}" i="${i}" ${generateAttributes(pieceEntity)}>
                        ${generateStageEntityContents(pieceEntity, i)}    
                    </div>
                `
            } else {
                gridGen += `<div class="gridpiece ${pieceClass}" style="--realX: ${pos.x}; --realY: ${pos.y}" slug="${pieceEntity.slug ? pieceEntity.slug : piece}" i=${i} ${generateAttributes(pieceEntity)}></div>`
            }
        });

        //generate + add the grid html, we replace undefined since we don't check for it when making the grid pieces
        let finalGrid = `
        <div class="reference" stage="${targetStage}" id="grid-ref" style="--stageWidth: ${stage.width}">
            ${gridGen.replace(/undefined/, '')} 

            <div class="truecreature">${stage.creature ? stage.creature() : ""}</div> 
        </div>`/* we insert some HTML in the player position graphic (or 'creature') if there is any */

        body.insertAdjacentHTML('beforeend', finalGrid.replaceAll("undefined", ""))

        //handle any special entity spawn-in functions
        if(stage.entities){
            for (const [entity, entityDef] of Object.entries(stage.entities)) {
                if(entityDef.spawnFunc) {
                    entityDef.spawnFunc();
                }
            }
        }

        //make the animated stage
        let newStage = document.querySelector('#grid-ref').cloneNode(true)
        newStage.id = "realgrid"
        newStage.classList.remove('reference')
        newStage.classList.add('grid')

        //handy references
        env.stage.ref = document.querySelector('#grid-ref')
        env.stage.plane = content.querySelector(".grid-plane")
        env.stage.animator = content.querySelector(".grid-animator")
        env.stage.container = content.querySelector(".grid-container")

        env.stage.animator.insertAdjacentElement('beforeend', newStage)
        //seems redundant but this is so i don't have to rewrite a bunch of old stuff
        env.stage.plane.setAttribute('activeStage', targetStage)
        env.stage.animator.setAttribute('activeStage', targetStage)
        env.stage.container.setAttribute('activeStage', targetStage)
        change('stageroom', targetStage)

        env.stage.real = content.querySelector("#realgrid")
        env.stage.real.classList.add("realgrid")
        env.stage.name = targetStage
        env.stage.current = env.stages[targetStage]
        env.stage.enemyPause = false
        env.stage.trackCam = false

        if(
            document.querySelector('#stage-navigator .swap')
            || env.stage.real.innerHTML.includes("face-creature")
        ) {
            env.stage.trackCam = true
        }
        
        //virtualgrid used in darkstep only
        env.stage.virtualGrid = env.stage.ref.querySelectorAll('.gridpiece')

        if(env.stage.current.fogRadius) {
            content.classList.add('darkstage')
            newStage.querySelectorAll('.gridpiece').forEach(el=>el.remove())
        } else {
            content.classList.remove('darkstage')
        }
        
        env.stage.visibleGridPieces = new Set()
        step()
        
        setTimeout(()=>{
            if(env.stages[targetStage].locale) { // TODO: i gotta refactor this later, we only need body really but css needs to be rewritten
                body.setAttribute('locale', `${env.stages[targetStage].locale}`);
                content.setAttribute('locale', `${env.stages[targetStage].locale}`);
                newStage.setAttribute('locale', `${env.stages[targetStage].locale}`);
            } else {
                content.removeAttribute('locale');
            }

            removeDeadStageEnemies()

            if(env.stages[targetStage].exec) env.stages[targetStage].exec()

            //stages can have arbitrary HTML added to the end for walls, ceilings, etc
            if(stage.html) { newStage.insertAdjacentHTML('beforeend', processStageVariables(stage.html)) }
            initializeAssetCanvases()

            if(
                (stage.tileSprites || env.stage.locales[stage.locale]) && 
                !env.stage.current.fogRadius &&
                !env.stage.current.noCanvasFloor
            ) {
                newStage.classList.add("canvas-floor")
                initializeFloorCanvas(stage, newStage)
            }
            
            //specific entry facing angles/directions if there are any
            let angles = {
                'up': 180,
                'right': 270,
                'down': 0,
                'left': 90,
            }
        
            //move the player to the spot, otherwise just spawn in the stage with no player (if no 'p' tile)
            if(spot !== false) {
                gridMoveTo(env.stage.ref.querySelector('#creature').parentElement, env.stage.ref.querySelectorAll(`.gridpiece`)[spot])
            }

            //either has the player face the specified direction, OR the default spawning direction
            let shouldFace = direction
            if(shouldFace == "false" || !shouldFace) shouldFace = stage.enterDirection
            if(shouldFace) {
                env.stage.lastMoved = shouldFace
                env.stage.plane.setAttribute('lastmoved', shouldFace); 
                env.stage.plane.style.setProperty('--camera-rotation', angles[shouldFace])
            }
            
            step()
            body.classList.add('stage-active')

            document.dispatchEvent(new CustomEvent('stage_change', { detail: { stage: targetStage} }));
        }, 10);

        setTimeout(()=>{
            if(!options.noFlash) flash(false)
            static.style.transitionDuration = ``
            body.classList.remove('stage-transition')
        }, options.duration * 0.5)
    }, options.duration); 
}

//generates the contains HTML/classes based on provided stage entity info
//i should be the index of the tile in the stage
//if not provided, this probably isn't for a conventional cystStage (i.e. for combat-grid)
function generateStageEntityContents(pieceEntity, i) {
    if(!pieceEntity.contains) return ""

    //dynamic prop stylings
    let dypStyle = ""
    let dypClass = ""
    if(pieceEntity.contains.examineEntity) dypClass += "preserve-3d has-target "
    let uniq = `${(pieceEntity.contains.id=="creature" || pieceEntity.unique) ? "" : env.stageEntityNum++}`
    let dypRef = pieceEntity.contains.dyp
    let htmlToShow = (pieceEntity.contains.examineEntity ? `<div class="target" ${pieceEntity.contains.examinePriority ? `priority="${pieceEntity.contains.examinePriority}"` : ''} entity="${pieceEntity.contains.examineEntity}"></div>` : "") + (pieceEntity.contains.html || "")

    if(dypRef) {
        dypClass += "dypcontent "
        for (const propName in dypRef) {
            const prop = dypRef[propName];

            switch(propName) {
                case "noback":
                case "cross":
                    dypClass += `dyp-${propName} `
                break

                case "class":
                    dypClass += `${prop} `
                break

                case "style":
                    dypStyle += `${prop}`
                break

                case "canvas":
                    dypClass += "dyp-canvas "
                    htmlToShow += `<canvas position="${dypRef.canvas.position}" repeat="${dypRef.canvas.repeat}" fit="${dypRef.canvas.fit}" basewidth="${dypRef.width}" baseheight="${dypRef.height}" sprite="${dypRef.canvas.sprite}" id="${uniq}_canvas"></canvas>`
                break

                default:
                    dypStyle += `--dyp-${propName}: ${prop};`
            }
        }
    }

    let contains = `
        <div 
            id="${pieceEntity.contains.id || "genprop" }${uniq}" 
            base="${pieceEntity.contains.id || "genprop" }"
            class="${pieceEntity.contains.class || ""} ${dypClass}" 
            type="${pieceEntity.contains.type}" 
            style="--piece-delay: ${Math.random() * -20}s; animation-delay: var(--piece-delay);${dypStyle};${pieceEntity.contains.style || ""}" 
            ${pieceEntity.contains.dialogue ? `dialogue="${pieceEntity.contains.dialogue /* this is on-contact dialogue triggered by stage enemies */}"` : ""}
            ${typeof i != "undefined" ? `origin-spot="${i+1}"` : ""}
        >
            ${htmlToShow}
        </div>
    `

    return contains
}

// a simple stage refresh shortcut that ensures the creature remains in the same spot
function refreshStage({duration = 100, noFlash = false, specificPlan = false} = {}) { changeStage(env.stage.name, env.stage.creatureI, env.stage.lastMoved, {duration, noFlash, specificPlan}) }

function convertStagePlanStringToArray(input) {
    if(typeof input != "object") return input.replace(/\s/g, '').split('');
    return input
}

function processStageVariables(input) {
    if(!input) return ""
    let effectiveInput = input
    if(typeof input == "function") effectiveInput = input()

    //i.e. .replaceAll("[stageW]", env.stage.stageW)
    return effectiveInput.replace(/\[(.*?)\]/g, (match, p1) => {
        return env.stage[p1] !== undefined ? env.stage[p1] : match;
    })
}

//turns left or right
function playerTurn({clockwise = true, specificDirection = false } = {}) {
    var newRotation
    var currentIndex = env.stage.moveDir.indexOf(env.stage.lastMoved)

    if(specificDirection) {
        env.stage.lastMoved = specificDirection
        switch(specificDirection) {
            case "up":
                newRotation = 180
            break
            case "right":
                newRotation = -90
            break
            case "down":
                newRotation = 0
            break
            case "left":
                newRotation = 90
            break
        }

    } else {
        let turn
        switch(clockwise) {
            case true:
                turn = -1
            break
    
            case false:
                turn = 1
            break
        }
    
        //handles any wrapping
        let newIndex = currentIndex + turn
        if(newIndex < 0) {
            newIndex = 3
        } else if(newIndex >= 4) {
            newIndex = 0
        }   
        
        let currentRotation = parseInt(env.stage.plane.style.getPropertyValue('--camera-rotation'))
        newRotation = currentRotation + (90 * turn)
        env.stage.lastMoved = env.stage.moveDir[newIndex]
    }

    //update relevant variables
    //rotate camera appropriately (offset handled in css by the lastmoved attr on html)
    env.stage.plane.setAttribute('lastmoved', env.stage.lastMoved)
    env.stage.plane.style.setProperty('--camera-rotation', `${newRotation}`)
}

//shortcut for moving player to specific x, y
function playerMoveTo(x, y, dir) {
    gridMoveTo(env.stage.ref.querySelector('#creature').parentElement, elementAtStageCoordinates(x, y));
    if(dir) playerTurn({specificDirection: dir})
    setTimeout(()=>step(), 10)
}

//resets the player camera spin
function stageAngleReset() {
    let noTransitions = document.querySelectorAll('.grid-animator, #realgrid .truecreature')
            
    noTransitions.forEach(el=>el.classList.add('no-transition'))
    env.stage.justStepped = true

    setTimeout(()=>{
        switch(env.stage.lastMoved) {
            case "down": env.stage.plane.style.setProperty("--camera-rotation", 0); break
            case "left": env.stage.plane.style.setProperty("--camera-rotation", 90); break
            case "right": env.stage.plane.style.setProperty("--camera-rotation", -90); break
            case "up": env.stage.plane.style.setProperty("--camera-rotation", 180); break
        }

        setTimeout(()=>{
            noTransitions.forEach(el=>el.classList.remove('no-transition'))
            env.stage.justStepped = false
        }, 25)
    }, 25)

    return 60
}

//updates both grid-container and any face-creature elements with angles/distance
//based on math and functions by marbelynrye - https://marbelynrye.000.pe/experiments/atan2relativity.html
function updateCameraTracking() {
    if(!env.stage.trackCam) return;
    content.querySelectorAll(".grid-container, .face-creature, .evil").forEach(el=>{
        if(!el.angleLast) el.angleLast = 0
        if(!el.angleAdd) el.angleAdd = 0

        const style = window.getComputedStyle(el)
        const distX = getCSSStepCalcValue(style.getPropertyValue("--distX"))
        const distY = getCSSStepCalcValue(style.getPropertyValue("--distY"))
        const atanResult = Math.atan2(distX, distY)
        const angle = (atanResult * (180 / Math.PI))

        //adjust to avoid the wretched spin
        if (el.angleLast >= 90 && el.angleLast <= 180  && angle < 0) {
            el.angleAdd += 360
        } 
        else if (el.angleLast >= -180 && el.angleLast <= -90 && angle > 0) {
            el.angleAdd -= 360
        } 
        
        el.style.setProperty("--faceAngle", `${angle + el.angleAdd}deg`)
        el.angleLast = angle
    })
}

//only handles untyped numbers i.e. in steps, any deg pass will crash
function getCSSStepCalcValue(input) {
    if (input.includes("calc(")) {
        const eval = new Function(`return ${input.replaceAll("calc", "")};`)
        return eval()
    } else {
        return input.trim()
    }
}

//set up the movement controls
var stageKeypress = (e) => { stepKey(e.key) }
function stepKey(key) {
    //we don't let any steps happen under certain circumstances
    if(env.stage.justStepped || 
        body.classList.contains('stage-transition') || 
        body.classList.contains('cull-stage') || 
        body.classList.contains('in-dialogue') || 
        body.classList.contains('in-combat') ||
        body.classList.contains('in-melee') ||
        document.documentElement.classList.contains('cutscene') || 
        document.activeElement.tagName == 'INPUT' ||
        document.activeElement.tagName == 'TEXTAREA'
    ) {
        return
    } else {
        env.stage.justStepped = true
        setTimeout(() => {env.stage.justStepped = false}, 100)
    }

    let homeBox = stageCoordinatesFromId('creature')
    let homePlate = elementAtStageCoordinates(homeBox.x, homeBox.y)
    var targetSquare
    var moving = false
    let closeMenu = true // suggestion per @ripplesplash from corrucord - previously closed menu immediately unless it was Z

    switch(key.toLowerCase()) {
        //movement
        case "arrowup":
        case "w": //move in direction you're looking
            moving = "forward"
        break;

        case "arrowleft":
        case "a": // turn left
            playerTurn({clockwise: false})
        break;

        case "arrowdown":
        case "s": //away from where you're looking
            moving = "back"
        break;

        case "arrowright":
        case "d": //turn right
            playerTurn()
        break;	

        case "e":
            //we only want this happening on stages where it's expected
            if(document.querySelector('#stage-navigator .swap') || check("TEMP!!allowswap")) {
                setTimeout(()=>{
                    content.classList.toggle('swapcam')
                    updateCameraTracking()
                }, stageAngleReset())
            }
        break;

        case "q":
            switch(body.getAttribute('quality')) {
                case "regular":
                    setQualityPreference('low')
                break

                case "low":
                    setQualityPreference('regular')
                break
            }
        break;

        case "z":
            if(page.partyMenuEnabled) togglePartyMenu()
            closeMenu = false;
        break;

        default:
            closeMenu = false;
        break;
    }

    //close any open menus
    if(body.classList.contains('in-menu') && closeMenu) exitMenu(false)

    if(moving) {
        var modifier = 1
        if(moving == "back") modifier = -1

        switch(env.stage.lastMoved) {
            case "up":
                targetSquare = elementAtStageCoordinates(homeBox.x, homeBox.y + modifier)
            break
            case "right":
                targetSquare = elementAtStageCoordinates(homeBox.x + modifier, homeBox.y)
            break
            case "down":
                targetSquare = elementAtStageCoordinates(homeBox.x, homeBox.y - modifier)
            break
            case "left":
                targetSquare = elementAtStageCoordinates(homeBox.x - modifier, homeBox.y)             
            break
        }
    }
    
    if(targetSquare != undefined) {
        gridMoveTo(homePlate, targetSquare);
        step()
        if(!env.stage.enemyPause) enemyStep()
    }
}

/* NEW EP3 GRID LOCATION FUNCTIONS - VIRTUAL */
function stageCoordinatesFromIndex(index) {
    let x = index % env.stage.stageW
    let y = Math.floor(index / env.stage.stageW)
    return { x, y }
}

function stageCoordinatesFromId(id) {
    const index = stageIndexFromEntId(id);


    if (index === -1) {
        return null; 
    }
    
    return stageCoordinatesFromIndex(index)
}

function stageIndexFromEntId(id) {
    for (let i = 0; i < env.stage.virtualGrid.length; i++) {
        if(env.stage.virtualGrid[i].lastElementChild) if (env.stage.virtualGrid[i].lastElementChild.id === id) {
            return i;
        }
    }
    return -1;
}

function stageIndexFromStageCoordinates(x, y) {
    if(y < 0 || x < 0 || x >= env.stage.stageW || y >= env.stage.stageH) return -1
    return (y * env.stage.stageW) + x
}

function elementAtStageCoordinates(x, y) {
    let index = stageIndexFromStageCoordinates(x, y);
    if (
        index < 0 || 
        index >= env.stage.virtualGrid.length
    ) {
        return null; // Coordinates are outside the grid range
    }

    return env.stage.virtualGrid[index];
}
/**********************************************/

//gets the index of the element in its parent
function getIndex(elm) { return [...elm.parentNode.children].indexOf(elm) }

//gets the X and Y of an entity
function getXYDist(pos1, pos2) {
    let dx = pos2.x - pos1.x;
    let dy = pos2.y - pos1.y;

    return Math.sqrt(dx * dx + dy * dy);
}

//unlock any locked entities if they either have no lock condition, or should be unlocked
function checkLocks() {
    document.querySelectorAll('.locked').forEach(e=>{
        if(e.getAttribute('lockflag') == "permalocked") return
        if(!e.hasAttribute('lockflag') || e.getAttribute('lockflag') == "" || getShowValidity(e.getAttribute('lockflag'))) {e.classList.remove('locked')}
    })
}

//moves the game world forward one step
function step() {
    checkLocks()

    //update fog as needed
    if(env.stage.current.fogRadius) {
        darkStep()
    }

    //move the creature, only if it's a different spot
    let realCreature = env.stage.real.querySelector('#creature')
    if(realCreature) {
        let realParent = realCreature.parentElement
        let refParent = env.stage.ref.querySelector('#creature').parentElement
        if(realParent.getAttribute('i') != refParent.getAttribute('i')) { 
            gridMoveTo(realParent, env.stage.real.querySelector(`.gridpiece[i="${refParent.getAttribute('i')}"]`));	

            //executes any onStep
            if(typeof env.stage.current.onStep == "function") env.stage.current.onStep()
            
            //executes any function the entity has within its room or default object
            let entSlug = refParent.getAttribute('slug')
            if(entSlug) { // cool fix suggested by ripplesplash 
                let customEnt, defaultEnt
                if(env.stage.current.entities && (customEnt = env.stage.current.entities[entSlug])) {
                    if(customEnt.exec) {customEnt.exec()}
                } else if (defaultEnt = env.stageEntities[entSlug]) {
                    if(defaultEnt.exec) {defaultEnt.exec()}
                }
            }
        }
    }

    //this sets up CSS camera values
    let creatureXY = stageCoordinatesFromId('creature');

    let gridPlane = env.stage.plane
    gridPlane.style.setProperty('--stage-steps-x', creatureXY.x)
    gridPlane.style.setProperty('--stage-steps-y', creatureXY.y)
    gridPlane.style.setProperty('--stage-width', env.stage.stageW)
    gridPlane.style.setProperty('--stage-height', env.stage.stageH)
    gridPlane.setAttribute('lastmoved', env.stage.lastMoved)

    env.stage.creatureLoc = creatureXY
    env.stage.creatureI = stageIndexFromStageCoordinates(creatureXY.x, creatureXY.y)

    //more cam stuff
    if(!env.currentDialogue.active && env.stage.customCam) {setCam()} // reset dialogue camera if wasn't unset automatically
    setTimeout(()=>updateCameraTracking(), 1) 
}

/* DARKNESS/FOG GRID NAVIGATION
    when a grid needs to be "dark", we only create the tiles necessary within the #realgrid element
    as you move in one direction, the tiles you should see are added onto the #realgrid and have their opacity animated in
    while the ones leaving your radius are animated out, then completely removed.
*/
env.stage.visibleGridPieces = new Set()
function darkStep() {
    // obtain elements within the fog radius of player
    // determine which elements need to be removed and which need to be added
    let maxRadius = env.stage.current.fogRadius;
    let spot = stageCoordinatesFromId('creature');
    let newVisibleGridPieces = new Set()

    // update stage with current fog state
    let realGrid = content.querySelector("#realgrid")
    realGrid.style.setProperty("--fogRadius", maxRadius)

    // get all intended tiles, update existing ones, add new ones
    let visRings = getSurroundingTiles(spot.x, spot.y, maxRadius);
    let newTiles = document.createDocumentFragment()

    visRings.forEach((ring, i) => ring.forEach(rEl => {
        //if the tile isn't in visible gridpieces, then we want to add it with a new index

        if(env.stage.visibleGridPieces.has(rEl)) { // UPDATE
            rEl.cousin.style.setProperty("--distX", rEl.position.xDist)
            rEl.cousin.style.setProperty("--distY", rEl.position.yDist)
            rEl.cousin.style.setProperty('--intendedOpacity', rEl.classList.contains("alwaysvis") ? 1 : fogOpacityCalculation(i, maxRadius, env.stage.current.fogAlgorithm))
            
        } else { // ADD (via documentFragment - lets you add a bunch of stuff at once)

            let tile = document.createElement("div")            
            //this can be done with style.setProperty, etc, but this just made sense to do since it's bulk
            tile.setAttribute('class', `piecewrapper vis ${rEl.innerHTML != "" ? "stuff" : "empty"} `)
            tile.setAttribute('style', `
                --distX: ${rEl.position.xDist}; 
                --distY: ${rEl.position.yDist};
                --realX: ${rEl.position.x};
                --realY: ${rEl.position.y};
                --intendedOpacity: ${rEl.classList.contains("alwaysvis") ? 1 : fogOpacityCalculation(i, maxRadius, env.stage.current.fogAlgorithm)};
            `)
            tile.innerHTML = rEl.outerHTML
            rEl.cousin = tile

            if(newVisibleGridPieces.has(rEl)) return;
            newTiles.appendChild(tile)
        }

        newVisibleGridPieces.add(rEl)
    }));

    // add all new tiles at once
    realGrid.appendChild(newTiles)

    // handle removal of tiles not in the new setup
    env.stage.visibleGridPieces.forEach(el => {
        if (!newVisibleGridPieces.has(el) && el.cousin) {
            el.cousin.remove()
            delete el.cousin
        }
    });

    
    // Update the global set of visible grid pieces
    env.stage.visibleGridPieces = newVisibleGridPieces;
    initializeAssetCanvases()
}

// gets arrays of squares of tiles around the specified point (using breadth-first search)
// think of them like concentric rings in order expanding outwards from the point
function getSurroundingTiles(centerX, centerY, maxRadius) {
    const result = []
    const visited = new Set()
    const queue = [{ x: centerX, y: centerY, radius: 0 }]

    while (queue.length > 0) {
        const { x, y, radius } = queue.shift()

        if (radius > maxRadius) break

        if (!visited.has(`${x},${y}`)) {
            result[radius] = result[radius] || []
            
            let piece = elementAtStageCoordinates(x, y)
            let xDist = x - centerX
            let yDist = y - centerY

            if (
                piece && 
                // tiles can have the "nothing" class, which tells the darkgrid not to render them
                (
                    ( // we render nothing tiles if they're immediately attached to the palyer
                        !piece.classList.contains('nothing') ||
                        (Math.abs(xDist) <= 1 && Math.abs(yDist) <= 1)
                    )

                    || piece.innerHTML != "" // we also render 'nothing' tiles if they actually contain something
                )
            ) {
                result[radius].push(piece)
                piece.position = {
                    x,
                    y,
                    xDist,
                    yDist
                }
            }

            visited.add(`${x},${y}`)

            if (radius < maxRadius) {
                queue.push(
                    { x: x - 1, y, radius: radius + 1 },
                    { x: x + 1, y, radius: radius + 1 },
                    { x, y: y - 1, radius: radius + 1 },
                    { x, y: y + 1, radius: radius + 1 }
                )
            }
        }
    }

    //get alwaysVis tiles
    let alwaysVisTiles = []
    env.stage.ref.querySelectorAll(".alwaysvis").forEach(tile=>{
        alwaysVisTiles.push(tile)
        tile.position = stageCoordinatesFromIndex(tile.getAttribute('i'))
        tile.position.xDist = tile.position.x - centerX
        tile.position.yDist = tile.position.y - centerY
    })
    if(alwaysVisTiles.length) result.push(alwaysVisTiles)

    return result;
}

function fogOpacityCalculation(radius, maxRadius, type) {
    const halfRadius = maxRadius / 2;
    switch(type) {
        case "quadratic":
            return 1 - (radius / maxRadius) ** 2

        case "half":
            return 1 - ((radius - halfRadius) / (maxRadius - halfRadius));

        case "hard":
            return 1;

        default: //linear
            return 1 - radius / maxRadius
    }
}

function gridMoveTo(origin, target, mirror = undefined, mirrorGridPiece = '#realgrid .gridpiece') {
    if(!target) {
        console.warn('nonexistent target in gridmoveto', origin, target)
        return
    }

    let targetStyles = getComputedStyle(target)
    if(
        targetStyles.pointerEvents != "none" &&
        !(target.classList.contains('blocks')) && 
        (target.classList.contains('gridpiece') || target.classList.contains('fp-gridpiece')) && 
        target.innerHTML == "" && origin.innerHTML != ""
    ) {
        let contents = origin.innerHTML
        target.innerHTML = contents //we use this again later dw
        origin.innerHTML = ""

        if(mirror) { //this is where we move the visual representation on the realgrid
            //dark stages use a different non-indexed system. this does not support different mirrorGridPieces (but that system also is from a scrapped thing so who cares)
            if(env.stage.current.fogRadius) { 
                let targetI = target.getAttribute('i')
                let originI = origin.getAttribute('i')
                let mirrorPosition = env.stage.real.querySelector(`.gridpiece[i="${originI}"]`)
                let targetPosition = env.stage.real.querySelector(`.gridpiece[i="${targetI}"]`)
                
                //first - check if the enemy is even rendered on the realgrid
                if(mirrorPosition) {
                    if(!targetPosition) {//if targetPosition is outside of the radius, then we just remove the mirror guy
                        mirrorPosition.innerHTML = ""
                    } else {//if they're already here and moving in the radius, just move em like normal
                        if(originI != targetI) {
                            gridMoveTo(mirrorPosition, targetPosition)
                        }
                    }

                } else if(targetPosition) { //if they're missing, we want to spawn them in on that point from the gridref
                    targetPosition.innerHTML = contents 
                }

                //if neither the mirror nor target position exist on the stage, then we don't do anything with da mirror. bye bye!!

            //regular function when the whole stage is visible
            } else { 
                let originI = getIndex(origin);
                let targetI = getIndex(target);
                
                if(originI != targetI) {
                    gridMoveTo(mirror, document.querySelectorAll(`${mirrorGridPiece}`)[targetI])
                }
            }
        }

        var targetContents = target.children;
        for (var i = 0; i < targetContents.length; i++) {
            targetContents[i].style.transform = ""
        }

        return true;

    } else if(target.classList.contains('teleport') && origin.children[0].classList.contains('player')) {
        let entSlug = target.getAttribute('slug')
            //if it's locked and it has a lockexec, do it
            if(target.classList.contains('locked') && target.getAttribute("lockexec").length) {
                if(entSlug && env.stages[body.id].entities) {
                    let defaultEnt = env.stageEntities[entSlug];
                    let customEnt = env.stages[body.id].entities[entSlug];
                    if(customEnt)
                        if(customEnt.lockExec) {customEnt.lockExec()}
                    else if (defaultEnt) {
                        if(defaultEnt.lockExec) {defaultEnt.lockExec()}
                    }
                }
            }
            //otherwise if it isn't locked, do any exec, then teleport to the stage specified
            else if(!target.classList.contains('locked')) {
                
                if(entSlug && env.stages[body.id].entities) {
                    let defaultEnt = env.stageEntities[entSlug];
                    let customEnt = env.stages[body.id].entities[entSlug];
                    if(customEnt) {
                        if(customEnt.exec) {customEnt.exec()}
                    } else if (defaultEnt) {
                        if(defaultEnt.exec) {defaultEnt.exec()}
                    }
                }

                changeStage(target.getAttribute('teleport-target'), 
                    target.getAttribute('spot') == "false" ? false : target.getAttribute('spot'),
                    target.getAttribute('shouldFace') == "false" ? false : target.getAttribute('shouldFace'), 
                )
            }
        return true;
        
    } else if(origin.children[0].classList.contains('player')) {
        console.log(`player gridMoveTo rejected - (blocks: ${target.classList.contains('blocks')}), (HTML: ${target.innerHTML})`)
    } else {
        console.log(`gridMoveTo rejected - (blocks: ${target.classList.contains('blocks')}), (HTML: ${target.innerHTML})`)
    }
    
    return false;
}

function updateStageCreature() {
    try{ 
        let creature = env.stage.real.querySelector('.truecreature')
        creature.innerHTML = env.stage.current.creature()
    } catch(e) {console.log('stage creature update failed', e)}
}

function generateAttributes (piece) {
    if(typeof piece.attributes != "object") return ""
    let finalAttributes = ""

    piece.attributes.forEach(attribute=>{
        finalAttributes += `${attribute[0]}="${attribute[1]}" `
    })

    console.log(finalAttributes)
    return finalAttributes
}

function stageCleanup() {
    if(env.stage.ref) env.stage.ref.remove()
    env.stage.ref = null
    try{ document.removeEventListener('keydown', stageKeypress) } catch(e) { /* never defined */ }
}

/* CAMERA CONTROLS 
/*  These are used mostly by dialogues to control how and when the player is allowed to swap their camera position
*   pauseSwapCam will remove swapCam and store it if they had it
*   forceSwapCam will do the opposite
*  both of these functions can be toggled
*  there's a way to do it with one function but this makes EXECs more readable
*/
function pauseSwapCam(pausing = true) {
    if(pausing) {
        if(content.classList.contains('swapcam')) env.storingSwap = true
        content.classList.remove('swapcam')
    } else if(env.storingSwap) { 
        content.classList.add('swapcam')
        env.storingSwap = false
    }
}

function forceSwapCam(forcing = true) {
    if(forcing) {
        if(!content.classList.contains('swapcam')) env.forcingSwap = true
        content.classList.add('swapcam')
        updateCameraTracking()
    } else if(env.forcingSwap) { 
        content.classList.remove('swapcam')
        env.forcingSwap = false
    }
}

/* shortcut for setting an attribute on grid-plane watched by CSS */
function specialCam(angle) {
    setTimeout(()=>{
        env.stage.plane.setAttribute('specialcam', angle ? angle : "")
    }, stageAngleReset())
}

/* specialCam's older sister, lets us not have to hardcode CSS classes for dialogue positions */
/* these get set on grid-container so that it's a step beneath the inline ones on grid-plane */
/* call with no settings to reset */
function setCam({
    x = false,
    y = false,
    height = false,
    distance = false,
    rotation = false,
    offsetCamera = false,
    offsetPersonal = false,
} = {}) {
    if(!env?.stage?.container) { console.warn('trying to use setCam with no active stage'); return }
    /* all of them are just direct sets or removes, nothing crazy happening here */
    let setSomething = false

    if(x !== false) {env.stage.container.style.setProperty("--camera-x", x); setSomething = true} else env.stage.container.style.removeProperty("--camera-x");
    if(y !== false) {env.stage.container.style.setProperty("--camera-y", y); setSomething = true} else env.stage.container.style.removeProperty("--camera-y");
    if(height !== false) {env.stage.container.style.setProperty("--camera-height", height); setSomething = true} else env.stage.container.style.removeProperty("--camera-height");
    if(distance !== false) {env.stage.container.style.setProperty("--camera-distance", distance); setSomething = true} else env.stage.container.style.removeProperty("--camera-distance");
    if(rotation !== false) {env.stage.container.style.setProperty("--camera-rotation", rotation); setSomething = true} else env.stage.container.style.removeProperty("--camera-rotation");
    if(offsetCamera !== false) {env.stage.container.style.setProperty("--camera-offset", offsetCamera); setSomething = true} else env.stage.container.style.removeProperty("--camera-offset");
    if(offsetPersonal !== false) {env.stage.container.style.setProperty("--camera-personal", offsetPersonal); setSomething = true} else env.stage.container.style.removeProperty("--camera-personal");

    if(setSomething) { // marker to reset on step
        env.stage.customCam = true
    } else {
        env.stage.customCam = false
    }
}

// ENEMY ADDITIONS
// enemy step should do the following:
    // for each enemy on the grid, unless it has 'nomove', move it one step closer to the player
    // if the enemy is directly next to the player
function enemyStep() {
    if(check("TEMP!!noevil") || !env.stage.ref || env.cutscene || body.classList.contains('in-dialogue')) return
    if(!env.currentDialogue.active && !document.querySelector('#combat')){
        var hitPlayer = false
        env.stage.ref.querySelectorAll(".evil").forEach(el => {
            if(el.classList.contains('dead', 'nomove')) return

            //prep a move towards player, executed after hit checks
            //check if this is above, to the left of, to the right of, or below player
            //randomly choose one of two (move x or move y) as flagged above
            let parentPos = stageCoordinatesFromId(el.id)
            let playerPos = stageCoordinatesFromId('creature')

            var relativeToPlayer = [];
            relativeToPlayer.push(parentPos.y < playerPos.y ? "below" : "above")
            relativeToPlayer.push(parentPos.x < playerPos.x ? "right" : "left")
            let move = relativeToPlayer[Math.floor(Math.random() * relativeToPlayer.length)];
            
            //check the sides to see if they're touching the player
            let checkThesePoints = [
                [parentPos.x, parentPos.y + 1],
                [parentPos.x, parentPos.y - 1],
                [parentPos.x - 1, parentPos.y],
                [parentPos.x + 1, parentPos.y]
            ]

            //marks checked spots for querying
            try {
                checkThesePoints.forEach(point => {
                    //prevent out of bounds checking to avoid wacky side effects
                    if(point[0] < 0 || point[1] < 0 || point[0] > (env.stage.stageW - 1) || point[1] > (env.stage.stageH - 1)) return

                    let spot = elementAtStageCoordinates(point[0], point[1])
                    if(!spot.classList.contains('checked')) { 
                        spot.classList.add('checked')
                        spot.setAttribute('challenger', `#${el.id}`)
                    }
                });
            } catch(e) {
                console.log('challenge check failed', e)
            }

            document.querySelectorAll('.checked').forEach(tile=>{
                if(!hitPlayer) {
                    let hitTarget = tile.querySelector('#creature') || tile.id == "creature"
                    let attacker = document.querySelector(tile.getAttribute('challenger'))
                    
                    if(hitTarget) {
                        hitPlayer = true
                        console.log('contact with player', tile)
                        let result = attacker.getAttribute('dialogue')

                        if(result.includes("EXEC::")) {
                            console.log('executing')
                            Function(`${result.replace('EXEC::', '')}`)()
                        } else { 
                            //start contact dialogue
                            console.log('result is dialogue', result)
                            try{
                                startDialogue(attacker.getAttribute('dialogue'), {
                                    originEntityID: attacker.id
                                });
                            } catch(e) { /* attacker despawned */ }
                        }

                    }

                    tile.classList.remove('checked')
                    tile.setAttribute('challenger', '')
                }
            })
            
            //if the player was hit, don't move
            if(hitPlayer) { return }

            //otherwise, move closer to the player
            if(getXYDist(parentPos, playerPos) <= 1 ) return
            let enemyMirror = env.stage.real.querySelector(`#${el.id}`)
            let mirrorParent = enemyMirror ? enemyMirror.parentElement : false
            
            switch(move) { //since on dark stages (fogRadius usage) the mirror isn't directly used, we just pass TRUE
                case "above":
                    gridMoveTo(el.parentElement, elementAtStageCoordinates(parentPos.x, parentPos.y - 1), env.stage.current.fogRadius ? true : mirrorParent)
                break;

                case "right":
                    gridMoveTo(el.parentElement, elementAtStageCoordinates(parentPos.x + 1, parentPos.y), env.stage.current.fogRadius ? true : mirrorParent)
                break;

                case "left":
                    gridMoveTo(el.parentElement, elementAtStageCoordinates(parentPos.x - 1, parentPos.y), env.stage.current.fogRadius ? true : mirrorParent)
                break;

                case "below":
                    gridMoveTo(el.parentElement, elementAtStageCoordinates(parentPos.x, parentPos.y + 1), env.stage.current.fogRadius ? true : mirrorParent)
                break;
            }
        })
    }
}

//'kills' the target enemy on the stage - behavior may change over time
function killStageEnemy(query) {
    if(query) document.querySelectorAll(`#grid-ref ${query}, .grid-plane ${query}`).forEach(el=>{
        el.parentElement.innerHTML = ""
    })

    if(!env.stage.real.innerHTML.includes("evil") && !env.stage.real.innerHTML.includes("face-creature") && !document.querySelector('#stage-navigator .swap')) {
        env.stage.trackCam = false
    }
}

//runs through the page's deadGuys if it has any, removing permadead enemies
function removeDeadStageEnemies() {
    var deadGuys
    try { deadGuys = page.flags.deadGuys[env.stage.name] } catch (e) {/* dead guys not defined yet */}
    if(!deadGuys) return

    deadGuys.forEach(spot=>{
        document.querySelectorAll(`.gridpiece:nth-child(${spot})`).forEach(el=>{
            el.innerHTML = ""
        })
    })

    if(!env.stage.real.innerHTML.includes("evil") && !env.stage.real.innerHTML.includes("face-creature") && !document.querySelector('#stage-navigator .swap')) {
        env.stage.trackCam = false
    }
}

function isStageClear(checkForSafe = true) {
    if(checkForSafe) return !env.stage.ref.querySelectorAll('.evil').length
    if(!checkForSafe) return env.stage.ref.querySelectorAll('.evil').length
}

/* engoodification temp positions */

//runs through all canvasses with sprites specified and renders the sprites spec'd onto them
function initializeAssetCanvases(force = false) {
    content.querySelectorAll("canvas[sprite]").forEach(canvas=> initializeAssetCanvas(canvas, force))
}

function initializeFloorCanvas(stageObj, realStage) {
    if(!realStage.classList.contains("canvas-floor")) return; // class added when detecting compatibility in changeStage

    let canvas = realStage.querySelector("#stagefloor")
    if(!canvas) {
        canvas = document.createElement('canvas')
        canvas.id = 'stagefloor'
        realStage.appendChild(canvas)
    }

    let ctx = canvas.getContext("2d")
    ctx.webkitImageSmoothingEnabled = false
    ctx.mozImageSmoothingEnabled = false
    ctx.imageSmoothingEnabled = false

    //size the canvas to the stage
    canvas.height = env.stage.stageH * 200
    canvas.width = env.stage.stageW * 200

    let tileArray = stageObj.tileSprites
    if(!tileArray && stageObj.locale) tileArray = env.stage.locales[stageObj.locale]

    /* 
        i.e.
        env.stage.locales["city"] = [
            [".empty.plain", "/img/local/city/tiles/empty.gif"],
            [".prop", "/img/local/city/tiles/occupied.gif"],
            [".road", "/img/textures/black.gif"],
        ]

        (or tileSprites: [] in the stage declaration)

        //same setup as on-stage canvasses i.e. walls, just in object form
        env.stage.locales["city"].(underFloor/overFloor) = {
            sprite: "/img/local/embassy/mind/marbling_pillars_short_m.gif",
            fit: "auto",
            position: "top",
            repeat: "no-repeat"
        }

        (ditto)
    */
    
    //initialize an image for each tile
    /*
        can append query strings to the tileSprite i.e. 
            [".empty.plain", "/img/blank.gif?+clear&+whateverelse"],
        
        currently support:
            +clear - clears the canvas space underneath the tile before rendering, allowing transparency cuts into base floor images
    */
    function render() {
        let loadedCount = 0
        for (let i = 0; i < tileArray.length; i++) {
            const [tileQuery, tileSprite] = tileArray[i]
            
            //when the image loads, loop thru stage tiles - if their slug matches the tile, render it to the canvas
            let loadImg = new Image()
            tileArray[i].push(loadImg)
            
            loadImg.onload = () => {
                //only once the last image loads do we go through and draw each one on the canvas
                //this is to ensure tiles are drawn in order (i.e. empty is drawn, then props over that, etc)
                loadedCount++
                if (loadedCount === tileArray.length) {
                    for(const [tileQuery, tileSprite, loadedImg] of tileArray) {
                        let tiles = env.stage.real.querySelectorAll(`#realgrid > .gridpiece${tileQuery}`)

                        for (let i = 0; i < tiles.length; i++) {
                            const thisTile = tiles[i]
                            coords = stageCoordinatesFromIndex(Number(thisTile.getAttribute("i")))
                            thisTile.classList.add("tile-in-canvas")
                
                            //render 
                            if(tileSprite.includes("+clear")) ctx.clearRect(coords.x * 200, coords.y * 200, 200, 200);
                            if(!thisTile.classList.contains("notile")) ctx.drawImage(loadedImg, coords.x * 200, coords.y * 200, 200, 200)
                        }

                        //similar to underFloor, we can render something over the floor too
                        let overFloor = stageObj.overFloor || tileArray.overFloor
                        if(overFloor) {
                            let img = new Image()
                            img.onload = () => canvasImageLoad({img, canvas, fit: overFloor.fit, repeat: overFloor.repeat, position: overFloor.position, existingCtx: ctx})
                            img.src = overFloor.sprite
                        }
                    }
                }
            }

            //we append flags in the form of a query string, but we don't need to actually use that when fetching
            loadImg.src = tileSprite.split("?")[0]
        }
    }

    //if the stage has a base image for the floor, we want to render that in the canvas first
    let underFloor = stageObj.underFloor || tileArray.underFloor
    if(underFloor && !stageObj.ignoreUnderFloor) {
        let img = new Image()
        img.onload = () => {
            canvasImageLoad({img, canvas, fit: underFloor.fit, repeat: underFloor.repeat, position: underFloor.position, existingCtx: ctx})
            render()
        }
        img.src = underFloor.sprite
    } else {
        render()
    }
}

//singular function 
function initializeAssetCanvas(canvas, force = false) {
    if(canvas.initialized && !force) return;
    if(force && canvas.initialied) { // means it was already drawn - need to clear
        canvas.getContext("2d").ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    //core drawing stuff
    const sprites = (canvas.getAttribute("sprite") || "").split(", ")
    const fits = (canvas.getAttribute("fit") || "contain").split(", ")
    const repeats = (canvas.getAttribute("repeat") || "no-repeat").split(", ")
    const positions = (canvas.getAttribute("position") || "").split(", ")

    //pixel scaling based on grid tile and dyp size
    canvas.width = processStageVariables(canvas.getAttribute("basewidth")) * 200
    canvas.height = processStageVariables(canvas.getAttribute("baseheight")) * 200

    //we want to make sure the images load and draw in the order they're specified
    let loadedCount = 0
    sprites.forEach((sprite) => {
        let loadImg = new Image()
        loadImg.onload = () => {
            //only once the last image loads do we go through and draw each one on the canvas
            loadedCount++
            if (loadedCount === sprites.length) {
                sprites.forEach((sprite, i) => {
                    setTimeout(()=>{
                        let img = new Image()
                        //default to just using the first specified thing if needed
                        img.onload = () => canvasImageLoad({img, canvas, fit: fits[i] || fits[0], repeat: repeats[i] || repeats[0], position: positions[i] || positions[0]})
                        img.src = sprite
                    }, 10 * i)
                })
            }
        }
        loadImg.src = sprite
    })

    canvas.initialized = true
}

//general loading function, allows us to pass existing contexts if desired
function canvasImageLoad({img, canvas, fit = "", repeat = "", position = "", existingCtx}) {
    let scaleMult, scaleX, scaleY, gfxWidth, gfxHeight, xPos, yPos
    console.log(img.src)

    let ctx = existingCtx
    if(!ctx) {
        ctx = canvas.getContext("2d")
        ctx.webkitImageSmoothingEnabled = false
        ctx.mozImageSmoothingEnabled = false
        ctx.imageSmoothingEnabled = false
    }

    //background-size style, without the % specs
    switch (fit) {
        case 'auto':
            gfxWidth = img.width
            gfxHeight = img.height
        break

        case 'stretch':
            gfxWidth = canvas.width
            gfxHeight = canvas.height
        break

        case 'stretch-y':
            gfxHeight = canvas.height
            gfxWidth = img.width
        break

        case 'stretch-x':
            gfxWidth = canvas.width
            gfxHeight = img.height
        break

        case 'cover':
            scaleX = canvas.width / img.width
            scaleY = canvas.height / img.height
            scaleMult = Math.max(scaleX, scaleY)

            gfxWidth = img.width * scaleMult
            gfxHeight = img.height * scaleMult
        break

        default:
        case 'contain':
            scaleX = canvas.width / img.width
            scaleY = canvas.height / img.height
            scaleMult = Math.min(scaleX, scaleY)

            gfxWidth = img.width * scaleMult
            gfxHeight = img.height * scaleMult
        break
    }

    //background-position style switch - twofold for both x and y. works like "top center"
    let splitPos = position.split(" ")
    switch (splitPos[0]) {
        case 'top': 
            yPos = 0
        break

        case 'center':
            yPos = (canvas.height - gfxHeight) / 2
            console.log("!!! RENDERING AT", yPos)
        break

        default:
        case 'bottom': 
            yPos = (canvas.height - gfxHeight)
            console.log("!!! RENDERING AT", yPos)
        break
    }

    switch (splitPos[1]) {
        case 'left': xPos = 0; console.log("!!! RENDERING AT", xPos); break
        case 'right': xPos = canvas.width - gfxWidth; console.log("!!! RENDERING AT", xPos); break

        default:
        case 'center': xPos = (canvas.width - gfxWidth) / 2; console.log("!!! RENDERING AT", xPos); break
    }

    //repeat options
    if(repeat != "no-repeat" && repeat.includes("repeat")) {
        switch(repeat) {
            case "repeat-x":
                for (let x = xPos - gfxWidth; x < canvas.width; x += gfxWidth) {
                    ctx.drawImage(img, x, yPos, gfxWidth, gfxHeight);
                }
                
                for (let x = xPos - gfxWidth; x > -gfxWidth; x -= gfxWidth) {
                    ctx.drawImage(img, x, yPos, gfxWidth, gfxHeight);
                }
            break

            case "repeat-y":
                for (let y = yPos - gfxHeight; y < canvas.height; y += gfxHeight) {
                    ctx.drawImage(img, xPos, y, gfxWidth, gfxHeight);
                }
    
                for (let y = yPos - gfxHeight; y > -gfxHeight; y -= gfxHeight) {
                    ctx.drawImage(img, xPos, y, gfxWidth, gfxHeight);
                }
            break

            case "repeat":
                for (let x = xPos - gfxWidth; x < canvas.width; x += gfxWidth) {
                    ctx.drawImage(img, x, yPos, gfxWidth, gfxHeight);
                    
                    for (let y = yPos - gfxHeight; y < canvas.height; y += gfxHeight) {
                        ctx.drawImage(img, x, y, gfxWidth, gfxHeight);
                    }
        
                    for (let y = yPos - gfxHeight; y > -gfxHeight; y -= gfxHeight) {
                        ctx.drawImage(img, x, y, gfxWidth, gfxHeight);
                    }
                }
                
                for (let x = xPos - gfxWidth; x > -gfxWidth; x -= gfxWidth) {
                    ctx.drawImage(img, x, yPos, gfxWidth, gfxHeight);
                    
                    for (let y = yPos - gfxHeight; y < canvas.height; y += gfxHeight) {
                        ctx.drawImage(img, x, y, gfxWidth, gfxHeight);
                    }
        
                    for (let y = yPos - gfxHeight; y > -gfxHeight; y -= gfxHeight) {
                        ctx.drawImage(img, x, y, gfxWidth, gfxHeight);
                    }
                }
            break
        }

        return //don't wanna double draw
    }

    ctx.drawImage(img, xPos, yPos, gfxWidth, gfxHeight)
}