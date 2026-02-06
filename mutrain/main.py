"""mutrain – train vision classifiers on cropped micropattern data.

Commands:
    mutrain dataset create --config dataset.yaml --output ./dataset
    mutrain train --dataset ./dataset --output ./model
"""

from __future__ import annotations

import typer

from dataset_cmd import dataset_app
from predict_cmd import predict_app
from train_cmd import train_app

app = typer.Typer(
    add_completion=False, help="Train vision classifiers on micropattern crops."
)
app.add_typer(dataset_app, name="dataset")
app.add_typer(train_app, name="train")
app.add_typer(predict_app, name="predict")

if __name__ == "__main__":
    app()
