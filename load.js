/* JUNTORTURE */
/* BASED ON "VIELK:: A CONCEPT MEMORYHOLE AS AN EXAMPLE NEW PAGE" BY NOVAE SYSTEM, BASED ON MAX'S AND OCTO'S PAGE CODE */


if(typeof pages == "undefined") {
    pages = {}
}


function newCustomPage({url, title, name, dialoguePrefix, remoteHTML}) {
    fetch(`${remoteHTML}`).then(
        function (response) {
            if (response.ok) {
                return response.text();
            }
            
            throw response;
        }).then(
        function (text) {
            pages[`${url}`] = {
                "title": `${title}`,
                "name": `${name}`,
                "dialoguePrefix": `${dialoguePrefix}`,
                "path": location.pathname,
                "flags" :{},
                "pageClass": "",
                "originalContent": "",
                "blocks": [
                `${text}`
                ],
                "responseURL": `https://corru.observer${url}`,
                "url": `${url}`
            }
            Object.defineProperty(swup.cache, 'pages', { get: () => pages, set: () => { } })
    })
    document.addEventListener('corru_resources_added', ()=>{
        if((location.pathname == `${url}`) && (page.dialoguePrefix.includes("notfound"))) {
            body.classList.add('hard-cut') // needed 4 the static sound to not break
            moveTo(`${url}`)
            body.classList.remove('hard-cut')
        }
    }, true)
    console.log(`PAGE DEFINED: ${url}`)
}

document.addEventListener('corru_entered', () => {
    if (page.path == '/local/uncosm/where/')
        env.uncode.enter = () => {
            let value = env.uncode.input.value.toLowerCase().replaceAll(".", "").replaceAll("/", "")

            if (value.length) {
                env.uncode.input.blur()
                cutscene(true)
                play('destabilize', 0.5)
                ratween(env.bgm, 0.1)
                content.classList.add('memorydive')

                if (!check("hub__funfriend-ah1") && value == "recosm") {
                    //fuck you lol
                    location.href = `/img/sprites/obesk/larval/larval7.gif`
                }

                if (value == "juntorture") {
                    setTimeout(() => {
                        cutscene(false)
                        moveTo(`/somewhere/deep/deep/down`)
                    }, 4000)
                } else {
                    fetch(`/local/uncosm/${value}/`).then(resp => {
                        if (resp.status == 404) {
                            cutscene(false)
                            startDialogue('wrong')
                        } else {
                            setTimeout(() => {
                                cutscene(false)
                                moveTo(`/local/uncosm/${value}/`)
                            }, 4000)
                        }
                    })
                }
            }
        }
})

newCustomPage({
    url: "/somewhere/deep/deep/down",
    title: "!!__ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERROR::ERRO",
    name: "error::unproceerror::error::err",
    dialoguePrefix: "junstart",
    remoteHTML: "https://tozi-coli.github.io/juntorture/start.html",
})

newCustomPage({
    url: "/somewhere/deep/deep",
    title: "!!__ERROR::ERR::UNPROCESSABLEOR::ERROR::ERROR::ERROR::::UNPROCESSABLE::ERROR::ERROR__!!",
    name: "error::unprocessableerror::unprocessable",
    dialoguePrefix: "junmiddle",
    remoteHTML: "https://tozi-coli.github.io/juntorture/middle.html",
})

newCustomPage({
    url: "/somewhere/deep",
    title: "!!__ERROR::UNPROCESSABLE__!",
    name: "error::unprocessable",
    dialoguePrefix: "junend",
    remoteHTML: "https://tozi-coli.github.io/juntorture/end.html",
})

newCustomPage({
    url: "/somewhere",
    title: "..__somewhere__..",
    name: "somewhere",
    dialoguePrefix: "junsomewhere",
    remoteHTML: "https://tozi-coli.github.io/juntorture/somewhere.html",
})
