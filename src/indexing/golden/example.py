"""
Python test file for indexing functionality.
Tests classes, methods, functions, and nested functions.
"""

import os
from typing import List, Optional


# Top-level function - should be captured
#region CHUNK (function): top_level_function
def top_level_function():
    """A top-level function."""
    return "hello"
#endregion CHUNK (function): top_level_function


# Top-level function with parameters - should be captured
#region CHUNK (function): calculate_sum
def calculate_sum(a: int, b: int) -> int:
    """Calculate sum of two numbers."""
    return a + b
#endregion CHUNK (function): calculate_sum


# Class definition - should be captured
#region CHUNK (class): ExampleClass
class ExampleClass:
    """An example class with various methods."""
    
    # Constructor - should NOT be captured (dunder method)
#region CHUNK (function): ExampleClass.__init__
    def __init__(self, name: str):
        self.name = name
        self._private_attr = "private"
#endregion CHUNK (function): ExampleClass.__init__
    
    # String representation - should NOT be captured (dunder method)
#region CHUNK (function): ExampleClass.__str__
    def __str__(self) -> str:
        return f"ExampleClass({self.name})"
#endregion CHUNK (function): ExampleClass.__str__
    
    # Regular method - should be captured
#region CHUNK (method): ExampleClass.get_name
#region CHUNK (function): ExampleClass.get_name
    def get_name(self) -> str:
        """Get the name."""
        return self.name
#endregion CHUNK (method): ExampleClass.get_name
#endregion CHUNK (function): ExampleClass.get_name
    
    # Method with parameters - should be captured
#region CHUNK (method): ExampleClass.set_name
#region CHUNK (function): ExampleClass.set_name
    def set_name(self, name: str) -> None:
        """Set the name."""
        self.name = name
#endregion CHUNK (method): ExampleClass.set_name
#endregion CHUNK (function): ExampleClass.set_name
    
    # Private method - should be captured (single underscore is not dunder)
#region CHUNK (method): ExampleClass._private_method
#region CHUNK (function): ExampleClass._private_method
    def _private_method(self) -> str:
        """A private method."""
        return self._private_attr
#endregion CHUNK (method): ExampleClass._private_method
#endregion CHUNK (function): ExampleClass._private_method
    
    # Static method - should be captured
    @staticmethod
#region CHUNK (function): ExampleClass.static_method
    def static_method() -> str:
        """A static method."""
        return "static"
#endregion CHUNK (function): ExampleClass.static_method
    
    # Class method - should be captured
    @classmethod
#region CHUNK (function): ExampleClass.class_method
    def class_method(cls) -> str:
        """A class method."""
        return cls.__name__
#endregion CHUNK (function): ExampleClass.class_method
    
    # Method with nested function - method should be captured, nested function should be captured
#region CHUNK (method): method_with_nested
#region CHUNK (function): method_with_nested
    def method_with_nested(self) -> str:
        """Method containing a nested function."""
        
        # Nested function - should be captured
#region CHUNK (function): method_with_nested.nested_helper
        def nested_helper(prefix: str) -> str:
            """A nested helper function."""
            return f"{prefix}: {self.name}"
#endregion CHUNK (function): method_with_nested.nested_helper
        
        return nested_helper("Result")
#endregion CHUNK (class): ExampleClass
#endregion CHUNK (method): method_with_nested
#endregion CHUNK (function): method_with_nested


# Another class - should be captured
#region CHUNK (class): AnotherClass
class AnotherClass:
    """Another example class."""
    
    # Constructor - should NOT be captured (dunder method)
#region CHUNK (function): AnotherClass.__init__
    def __init__(self, value: int):
        self.value = value
#endregion CHUNK (function): AnotherClass.__init__
    
    # Method - should be captured
#region CHUNK (method): get_value
#region CHUNK (function): get_value
    def get_value(self) -> int:
        """Get the value."""
        return self.value
#endregion CHUNK (class): AnotherClass
#endregion CHUNK (method): get_value
#endregion CHUNK (function): get_value


# Function with nested functions - all should be captured
#region CHUNK (function): outer_function
def outer_function(items: List[str]) -> List[str]:
    """Function with nested functions."""
    
    # First nested function - should be captured
#region CHUNK (function): outer_function.filter_empty
    def filter_empty(items: List[str]) -> List[str]:
        """Filter out empty strings."""
        return [item for item in items if item.strip()]
#endregion CHUNK (function): outer_function.filter_empty
    
    # Second nested function - should be captured
#region CHUNK (function): outer_function.capitalize_items
    def capitalize_items(items: List[str]) -> List[str]:
        """Capitalize all items."""
        return [item.capitalize() for item in items]
#endregion CHUNK (function): outer_function.capitalize_items
    
    # Third nested function with its own nested function - both should be captured
#region CHUNK (function): outer_function.process_items
    def process_items(items: List[str]) -> List[str]:
        """Process items with nested processing."""
        
        # Deeply nested function - should be captured
#region CHUNK (function): outer_function.process_items.add_prefix
        def add_prefix(item: str) -> str:
            """Add prefix to item."""
            return f"processed: {item}"
#endregion CHUNK (function): outer_function.process_items.add_prefix
        
        return [add_prefix(item) for item in items]
#endregion CHUNK (function): outer_function.process_items
    
    filtered = filter_empty(items)
    capitalized = capitalize_items(filtered)
    return process_items(capitalized)
#endregion CHUNK (function): outer_function


# Class with inheritance - should be captured
#region CHUNK (class): ChildClass
class ChildClass(ExampleClass):
    """A child class."""
    
    # Constructor - should NOT be captured (dunder method)
#region CHUNK (function): ChildClass.__init__
    def __init__(self, name: str, age: int):
        super().__init__(name)
        self.age = age
#endregion CHUNK (function): ChildClass.__init__
    
    # Override method - should be captured
#region CHUNK (method): ChildClass.get_name
#region CHUNK (function): ChildClass.get_name
    def get_name(self) -> str:
        """Override get_name method."""
        return f"{self.name} (age: {self.age})"
#endregion CHUNK (method): ChildClass.get_name
#endregion CHUNK (function): ChildClass.get_name
    
    # New method - should be captured
#region CHUNK (method): get_age
#region CHUNK (function): get_age
    def get_age(self) -> int:
        """Get the age."""
        return self.age
#endregion CHUNK (class): ChildClass
#endregion CHUNK (method): get_age
#endregion CHUNK (function): get_age


# Function that returns a function - both should be captured
#region CHUNK (function): create_multiplier
def create_multiplier(factor: int):
    """Create a multiplier function."""
    
    # Nested function - should be captured
#region CHUNK (function): create_multiplier.multiplier
    def multiplier(value: int) -> int:
        """Multiply value by factor."""
        return value * factor
#endregion CHUNK (function): create_multiplier.multiplier
    
    return multiplier
#endregion CHUNK (function): create_multiplier


# Lambda functions are not captured by our queries (they don't have names in the AST)
double = lambda x: x * 2
triple = lambda x: x * 3


# Function with decorator - should be captured
@staticmethod
#region CHUNK (function): decorated_function
def decorated_function() -> str:
    """A decorated function."""
    return "decorated"
#endregion CHUNK (function): decorated_function


if __name__ == "__main__":
    # Test the functionality
    example = ExampleClass("test")
    print(example.get_name())
    print(example.method_with_nested())
    
    items = ["  hello  ", "", "world", "  "]
    processed = outer_function(items)
    print(processed)
    
    child = ChildClass("child", 10)
    print(child.get_name())
    print(child.get_age())
    
    mult = create_multiplier(5)
    print(mult(3))
    
    print(double(4))
    print(triple(4))
    print(decorated_function())