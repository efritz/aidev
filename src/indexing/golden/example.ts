// #region CHUNK (var): l1
let l1 = 110
// #endregion CHUNK (var): l1
// #region CHUNK (var): c1
const c1 = 120
// #endregion CHUNK (var): c1
// #region CHUNK (var): l2
export let l2 = 130
// #endregion CHUNK (var): l2
// #region CHUNK (var): c2
export const c2 = 140
// #endregion CHUNK (var): c2

// #region CHUNK (function): f1
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
// #region CHUNK (named-arrow-function): f1.cmp1
    let cmp1 = (a: number, b: number) => a - b
// #endregion CHUNK (named-arrow-function): f1.cmp1
// #region CHUNK (named-arrow-function): f1.cmp2
    const cmp2 = (a: number, b: number) => a - b
// #endregion CHUNK (named-arrow-function): f1.cmp2
// #region CHUNK (function): f1.cmp3
    function cmp3(a: number, b: number) {
        return a - b
    }
// #endregion CHUNK (function): f1.cmp3

    // Appease the linters
    console.log({ value: l1 + c1 + l2 + c2 + l3 + c3 })
    new C2()
    f3()
    cmp1(1, 2)
    cmp2(1, 2)
    cmp3(1, 2)
}
// #endregion CHUNK (function): f1

// #region CHUNK (function): f2
export function f2() {
    f1()
}
// #endregion CHUNK (function): f2

// #region CHUNK (type): t1
export type t1 = {
    x: number
    y: number
    z: number
}
// #endregion CHUNK (type): t1

// #region CHUNK (type): t2
type t2 = {
    w: number
}
// #endregion CHUNK (type): t2

// #region CHUNK (type): i1
export interface i1 {
    run<T>(): T | Error
}
// #endregion CHUNK (type): i1

// #region CHUNK (function): f3
function f3() {
    // Not captured
    type t3 = {
        q: number
    }

    const v1: t2 = { w: 42 }
    const v2: t3 = { q: 42 }

    // Appease the linters
    console.log({ value: v1.w + v2.q })
}
// #endregion CHUNK (function): f3

// #region CHUNK (class): C1
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

// #region CHUNK (method): C1.m1
    m1() {
        return this.l1 + this.c1
    }
// #endregion CHUNK (method): C1.m1

// #region CHUNK (method): C1.m2
    static m2() {
        return C1.l2 + C1.c2
    }
// #endregion CHUNK (method): C1.m2
}
// #endregion CHUNK (class): C1

// #region CHUNK (class): C2
class C2 {
// #region CHUNK (method): C2.m3
    static m3() {
        return 42
    }
// #endregion CHUNK (method): C2.m3
}
// #endregion CHUNK (class): C2

// #region CHUNK (function): f4
export function f4() {
    return {
// #region CHUNK (named-arrow-function): f4.k1
        k1: ({ name, value }: { name: string; value: number }) => ({
            name,
            value,
// #region CHUNK (named-arrow-function): f4.k1.k2
            k2: () => value * 2,
// #endregion CHUNK (named-arrow-function): f4.k1.k2
// #region CHUNK (named-arrow-function): f4.k1.k3
            k3: function (multiplier: number) {
                return value * multiplier
            },
// #endregion CHUNK (named-arrow-function): f4.k1.k3
// #region CHUNK (method): f4.k1.m4
            m4(prefix: string) {
                return `${prefix}: ${name} = ${value}`
            },
// #endregion CHUNK (method): f4.k1.m4
        }),
// #endregion CHUNK (named-arrow-function): f4.k1
    }
}
// #endregion CHUNK (function): f4
