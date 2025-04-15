;; Capture lambda expressions assigned to variables

(field_declaration
  (variable_declarator
    name: (identifier) @name
    value: (lambda_expression)
  )
) @lambda

;; Capture lambda expressions assigned to variables with modifiers

(field_declaration
  (modifiers)
  (variable_declarator
    name: (identifier) @name
    value: (lambda_expression)
  )
) @lambda

;; Capture lambda expressions in variable declarations within methods

(local_variable_declaration
  (variable_declarator
    name: (identifier) @name
    value: (lambda_expression)
  )
) @lambda

;; Capture lambda expressions in assignments

(assignment_expression
  left: (identifier) @name
  right: (lambda_expression)
) @lambda

;; Capture lambda expressions passed as method arguments
;; Note: These won't have explicit names, but we capture them for completeness

(argument_list
  (lambda_expression)
) @lambda

;; Capture lambda expressions in return statements
;; Note: These won't have explicit names, but we capture them for completeness

(return_statement
  (lambda_expression)
) @lambda
