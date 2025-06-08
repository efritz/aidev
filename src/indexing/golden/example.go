package example

import "slices"

const (
// #region CHUNK (var): c1
	c1 = 110
// #endregion CHUNK (var): c1
// #region CHUNK (var): c2
	c2 = 120
// #endregion CHUNK (var): c2
)

var (
// #region CHUNK (var): v1
	v1 = 140
// #endregion CHUNK (var): v1
// #region CHUNK (var): v2
	v2 = 150
// #endregion CHUNK (var): v2
)

// #region CHUNK (var): c3
const c3 = 130
// #endregion CHUNK (var): c3

// #region CHUNK (var): v3
var v3 = 160
// #endregion CHUNK (var): v3

// #region CHUNK (func): F
func F() {
	// Not captured
	const (
		c4 = 170
		c5 = 180
	)

	// Not captured
	var (
		v4 = 190
		v5 = 200
	)

	// Not captured
	const c6 = 210
	var v6 = 220

	// Not captured
	go func() {}()

	// Not captured
	slices.SortFunc([]int{1, 2, 3}, func(a, b int) int {
		return b - a
	})

	// Captured (named)
	var (
// #region CHUNK (named-func-expr): F.f1
		f1 = func() {}
// #endregion CHUNK (named-func-expr): F.f1

// #region CHUNK (named-func-expr): F.f2
		f2 func() = func() {}
// #endregion CHUNK (named-func-expr): F.f2
	)

	// Captued (named)
// #region CHUNK (named-func-expr): F.f3
	f3 := func() {}
// #endregion CHUNK (named-func-expr): F.f3

	// Appease the linters
	_ = v4
	_ = v5
	_ = v6
	_ = f1
	_ = f2
	_ = f3
}
// #endregion CHUNK (func): F

// #region CHUNK (type): S
type S struct {
	x int
	y int
	z int

	// not captured
	children []struct {
		w int
	}
}
// #endregion CHUNK (type): S

type (
// #region CHUNK (type): S2
	S2 struct{ q bool }
// #endregion CHUNK (type): S2
// #region CHUNK (type): S3
	S3 = S2
// #endregion CHUNK (type): S3
// #region CHUNK (type): S4
	S4 S3
// #endregion CHUNK (type): S4
)

// #region CHUNK (func): M
func (s S) M() {
	// Not captured
	type Local struct{}
}
// #endregion CHUNK (func): M

// #region CHUNK (type): I
type I interface {
	Do() error
}
// #endregion CHUNK (type): I

// #region CHUNK (func): Do
func (s S) Do() error {
	// Not captured
	type Foo interface {
		Local()
	}

	return nil
}
// #endregion CHUNK (func): Do

// #region CHUNK (type): Proxy
type Proxy struct {
	do func() error
}
// #endregion CHUNK (type): Proxy

// #region CHUNK (func): NewProxy
func NewProxy() *Proxy {
	return &Proxy{
// #region CHUNK (named-func-expr): NewProxy.do
		do: func() error {
			return nil
		},
// #endregion CHUNK (named-func-expr): NewProxy.do
	}
}
// #endregion CHUNK (func): NewProxy
