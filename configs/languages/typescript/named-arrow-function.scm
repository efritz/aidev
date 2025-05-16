;; Capture arrow functions bound to an explicit variable

(variable_declarator
  name: (identifier) @name
  value: [(arrow_function) (function_expression)]
) @function_expr

;; Capture functions bound to the field of an object literal

(object
  (pair
    key: (property_identifier) @name
    value: [(arrow_function) (function_expression)]
  ) @function_expr
)
