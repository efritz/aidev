let l1 = 110
const c1 = 120
export let l2 = 130
export const c2 = 140

function f1() {
    // Not captured
    let l3 = 180
    const c3 = 190

    // Not captured
    ;(function () {})()
    ;(function inner() {})()

    // Not captured
    ;[1, 2, 3].sort((a, b) => a - b)

    // Captured (named)
    let cmp1 = (a: number, b: number) => a - b
    const cmp2 = (a: number, b: number) => a - b
    function cmp3(a: number, b: number) {
        return a - b
    }

    // Appease the linters
    const _ = l1 + c1 + l2 + c2 + l3 + c3
    const _ = new C2()
    f3()
    cmp1(1, 2)
    cmp2(1, 2)
    cmp3(1, 2)
}

export function f2() {
    f1()
}

export type t1 = {
    x: number
    y: number
    z: number
}

type t2 = {
    w: number
}

export interface i1 {
    run<T>(): T | Error
}

function f3() {
    // Not captured
    type t3 = {
        q: number
    }

    const v1: t2 = { w: 42 }
    const v2: t3 = { q: 42 }

    // Appease the linters
    const _ = v1
    const _ = v2
}

export class C1 {
    // Not captured
    private l1 = 110
    private c1 = 120

    // Not captured
    static l2 = 130
    static c2 = 140

    constructor() {
        this.l1 = 150
        this.c1 = 160
    }

    m1() {
        return this.l1 + this.c1
    }

    static m2() {
        return C1.l2 + C1.c2
    }
}

class C2 {
    static m3() {
        return 42
    }
}
