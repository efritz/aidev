;; Capture function expressions that are named as part of a var block

(var_spec
  name: (identifier) @name
  value: (expression_list
    (func_literal)
  )
) @function

;; Capture function expressions that are named as part of a var assignment

(short_var_declaration
  left: (_) @name
  right: (expression_list
    (func_literal)
  )
) @function

;; Cpature function expressions that are bound to struct literal fields

(keyed_element
  (literal_element (identifier)) @name
  (literal_element (func_literal))
) @function
