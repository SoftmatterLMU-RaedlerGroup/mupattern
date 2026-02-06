"""mutrain train – train a ResNet-18 binary classifier on a HuggingFace Dataset."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import evaluate
import numpy as np
import typer
from datasets import load_from_disk
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    Trainer,
    TrainingArguments,
)

train_app = typer.Typer(help="Model training commands.")


def _make_transforms(processor: AutoImageProcessor):
    """Return a function that preprocesses dataset examples for the model."""

    def transforms(examples: dict) -> dict:
        images = []
        for img in examples["image"]:
            # Convert grayscale to RGB (ResNet expects 3 channels)
            if img.mode != "RGB":
                img = img.convert("RGB")
            images.append(img)
        inputs = processor(images, return_tensors="pt")
        inputs["labels"] = examples["label"]
        return inputs

    return transforms


@train_app.command("run")
def run(
    dataset: Annotated[
        Path,
        typer.Option(
            exists=True,
            file_okay=False,
            help="Path to the HuggingFace Dataset created by 'mutrain dataset create'.",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output directory for the trained model."),
    ],
    epochs: Annotated[
        int,
        typer.Option(help="Number of training epochs."),
    ] = 20,
    batch_size: Annotated[
        int,
        typer.Option(help="Training batch size."),
    ] = 32,
    lr: Annotated[
        float,
        typer.Option(help="Learning rate."),
    ] = 1e-4,
    split: Annotated[
        float,
        typer.Option(help="Fraction of data to use for validation."),
    ] = 0.2,
) -> None:
    """Train a ResNet-18 binary classifier."""
    typer.echo("Loading dataset...")
    ds = load_from_disk(str(dataset))

    # Train/val split
    ds_split = ds.train_test_split(test_size=split, seed=42, stratify_by_column="label")
    train_ds = ds_split["train"]
    val_ds = ds_split["test"]
    typer.echo(f"Train: {len(train_ds)}, Val: {len(val_ds)}")

    # Model and processor
    model_name = "microsoft/resnet-18"
    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForImageClassification.from_pretrained(
        model_name,
        num_labels=2,
        label2id={"absent": 0, "present": 1},
        id2label={0: "absent", 1: "present"},
        ignore_mismatched_sizes=True,
    )

    # Apply transforms
    transform_fn = _make_transforms(processor)
    train_ds = train_ds.with_transform(transform_fn)
    val_ds = val_ds.with_transform(transform_fn)

    # Metrics
    accuracy = evaluate.load("accuracy")
    f1 = evaluate.load("f1")

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        acc = accuracy.compute(predictions=preds, references=labels)
        f1_score = f1.compute(predictions=preds, references=labels)
        return {**acc, **f1_score}

    # Training
    training_args = TrainingArguments(
        output_dir=str(output),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=lr,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_steps=10,
        remove_unused_columns=False,
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
    )

    typer.echo("Training...")
    trainer.train()

    typer.echo("Saving best model...")
    trainer.save_model(str(output / "best"))
    processor.save_pretrained(str(output / "best"))

    # Final eval
    metrics = trainer.evaluate()
    typer.echo(f"Final metrics: {metrics}")
    typer.echo(f"Model saved to {output / 'best'}")
