from collections.abc import Callable

ProgressCallback = Callable[[float, str], None]
