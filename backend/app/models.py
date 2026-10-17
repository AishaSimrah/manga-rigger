from typing import Optional

from pydantic import BaseModel, Field, model_validator


class Box(BaseModel):
    """A rectangle in normalized image coordinates (0..1)."""
    cx: float = Field(ge=0, le=1)
    cy: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class Settings(BaseModel):
    breath_amount: float = Field(0.015, ge=0, le=0.1)
    breath_speed: float = Field(0.25, gt=0, le=2)
    blink_min: float = Field(2.0, ge=0.5, le=20)
    blink_max: float = Field(6.0, ge=0.5, le=30)
    mouth_sensitivity: float = Field(4.0, ge=0.5, le=20)

    @model_validator(mode="after")
    def check_blink_range(self):
        if self.blink_max < self.blink_min:
            raise ValueError("blink_max must be >= blink_min")
        return self


class Rig(BaseModel):
    left_eye: Optional[Box] = None
    right_eye: Optional[Box] = None
    mouth: Optional[Box] = None
    settings: Settings = Field(default_factory=Settings)
    