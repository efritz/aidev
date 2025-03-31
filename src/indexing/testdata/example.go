package example

import "slices"

const (
	c1 = 110
	c2 = 120
)

var (
	v1 = 140
	v2 = 150
)

const c3 = 130

var v3 = 160

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
		f1 = func() {}

		f2 func() = func() {}
	)

	// Captued (named)
	f3 := func() {}

	// Appease the linters
	_ = v4
	_ = v5
	_ = v6
	_ = f1
	_ = f2
	_ = f3
}

type S struct {
	x int
	y int
	z int

	// not captured
	children []struct {
		w int
	}
}

type (
	S2 struct{ q bool }
	S3 = S2
	S4 S3
)

func (s S) M() {
	// Not captured
	type Local struct{}
}

type I interface {
	Do() error
}

func (s S) Do() error {
	// Not captured
	type Foo interface {
		Local()
	}

	return nil
}

type Proxy struct {
	do func() error
}

func NewProxy() *Proxy {
	return &Proxy{
		do: func() error {
			return nil
		},
	}
}
