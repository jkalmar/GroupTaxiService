function timeout(n) {
    return new Promise(cb => setTimeout(cb, n))
 }

async function b() {
    console.log("first await")
    throw 1
}



async function dojob() {

        await b()
        await timeout(2000)
        console.log("after first await timeout")


    console.log("dojob finish")



    return {ok : 10}
}

console.log("Starting job")
o = dojob()

o.then( (result) => {
    console.log(result)
    console.log(o)
} ).catch( (e) => {
    console.log(e)
} )

