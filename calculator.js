(() => {
  const form = document.getElementById("training-calculator");
  if (!form) {
    return;
  }

  const errorMessage = document.getElementById("form-error");
  const results = document.getElementById("results");
  const placeholder = document.getElementById("results-placeholder");
  const levelSelect = document.getElementById("troop-level");
  const trainingPanel = document.getElementById("training-mode-panel");
  const upgradePanel = document.getElementById("upgrade-mode-panel");
  const modeToggle = document.getElementById("mode-toggle");
  const upgradeFrom = document.getElementById("upgrade-from");
  const upgradeTo = document.getElementById("upgrade-to");
  let upgradeMode = false;
  const numberFormat = new Intl.NumberFormat();
  const timeFields = {
    training: ["training-days", "training-hours", "training-minutes", "training-seconds"],
    speedups: ["speedup-days", "speedup-hours", "speedup-minutes", "speedup-seconds"]
  };
  const secondsPerUnit = [86400, 3600, 60, 1];

  const pointsForLevel = (level) => {
    const option = Array.from(levelSelect.options).find((item) => Number(item.value) === level);
    return option ? Number(option.dataset.points) : NaN;
  };

  const updateUpgradeOptions = () => {
    const fromLevel = Number(upgradeFrom.value || 1);
    const previousDestination = Number(upgradeTo.value);
    upgradeTo.replaceChildren();

    Array.from(levelSelect.options)
      .filter((option) => Number(option.value) > fromLevel)
      .forEach((option) => {
        const destination = document.createElement("option");
        destination.value = option.value;
        destination.textContent = `Level ${option.value}`;
        destination.dataset.points = option.dataset.points;
        upgradeTo.append(destination);
      });

    const retainedDestination = Array.from(upgradeTo.options).find((option) => Number(option.value) === previousDestination);
    if (retainedDestination) {
      upgradeTo.value = retainedDestination.value;
    }
  };

  const setMode = (useUpgradeMode) => {
    upgradeMode = useUpgradeMode;
    trainingPanel.hidden = upgradeMode;
    upgradePanel.hidden = !upgradeMode;
    trainingPanel.querySelectorAll("input, select").forEach((field) => {
      field.disabled = upgradeMode;
    });
    upgradePanel.querySelectorAll("input, select").forEach((field) => {
      field.disabled = !upgradeMode;
    });
    modeToggle.textContent = upgradeMode ? "Training Mode" : "Upgrade Troops";
    modeToggle.setAttribute("aria-pressed", String(upgradeMode));
    document.getElementById("setup-description").textContent = upgradeMode
      ? "Choose the starting and destination troop tiers, then set the size of each upgrade batch."
      : "Choose the troop tier and the size of each training batch.";
    document.getElementById("results-kicker").textContent = upgradeMode ? "UPGRADE ESTIMATE" : "TRAINING ESTIMATE";
    document.getElementById("results-summary").textContent = upgradeMode
      ? "Based on your selected upgrade levels and available speedups."
      : "Based on your selected level and available speedups.";
    document.getElementById("result-footnote").textContent = upgradeMode
      ? "Upgrade points are the difference between the selected troop levels."
      : "Points shown are for this troop level only.";
    document.querySelector(".form-note").textContent = upgradeMode
      ? "Only fully completed upgrade batches are counted."
      : "Only fully completed training batches are counted.";
    document.getElementById("result-level-label").textContent = upgradeMode ? "Original troop level" : "Selected troop level";
    document.getElementById("result-to-level-row").hidden = !upgradeMode;
    document.getElementById("result-points-label").textContent = upgradeMode ? "Points gained per upgraded troop" : "Points per troop";
    document.getElementById("result-batch-label").textContent = upgradeMode ? "Troops upgraded per batch" : "Troops per batch";
    document.getElementById("result-batches-label").textContent = upgradeMode ? "Completed upgrade batches" : "Completed batches";
    document.getElementById("result-troops-label").textContent = upgradeMode ? "Total troops upgraded" : "Total troops trained";
    clearError();
    hideResults();
  };

  Array.from(levelSelect.options)
    .filter((option) => Number(option.value) < 12)
    .forEach((option) => {
      const source = document.createElement("option");
      source.value = option.value;
      source.textContent = `Level ${option.value}`;
      upgradeFrom.append(source);
    });
  updateUpgradeOptions();

  modeToggle.addEventListener("click", () => {
    if (upgradeMode) {
      setMode(false);
    } else {
      setMode(true);
    }
  });

  upgradeFrom.addEventListener("change", updateUpgradeOptions);

  const setError = (message, field) => {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  };

  const clearError = () => {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
    form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
      field.removeAttribute("aria-invalid");
    });
  };

  const hideResults = () => {
    results.hidden = true;
    placeholder.hidden = false;
  };

  const readInteger = (id) => {
    const field = document.getElementById(id);
    if (!field.checkValidity()) {
      const label = field.labels.length ? field.labels[0].textContent : "value";
      throw { field, message: `Enter a valid whole number for ${label.toLowerCase()}.` };
    }

    const value = Number(field.value);
    if (!Number.isSafeInteger(value)) {
      const label = field.labels.length ? field.labels[0].textContent : "value";
      throw { field, message: `${label} is too large to calculate safely.` };
    }
    return value;
  };

  const readDuration = (ids) => {
    const total = ids.reduce((sum, id, index) => {
      const value = readInteger(id);
      if ((index === 1 && value >= 24) || (index >= 2 && value >= 60)) {
        const field = document.getElementById(id);
        const label = field.labels.length ? field.labels[0].textContent : "time";
        throw { field, message: `${label} is outside its allowed range.` };
      }
      return sum + value * secondsPerUnit[index];
    }, 0);

    if (!Number.isSafeInteger(total)) {
      throw { field: document.getElementById(ids[0]), message: "The entered time is too large to calculate safely." };
    }
    return total;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearError();

    try {
      const batchSize = readInteger(upgradeMode ? "upgrade-troops-per-batch" : "troops-per-batch");
      const trainingSeconds = readDuration(timeFields.training);
      const speedupSeconds = readDuration(timeFields.speedups);

      if (batchSize < 1) {
        const field = document.getElementById(upgradeMode ? "upgrade-troops-per-batch" : "troops-per-batch");
        throw { field, message: `Troops per ${upgradeMode ? "upgrade" : "training"} batch must be at least 1.` };
      }
      if (trainingSeconds < 1) {
        throw { field: document.getElementById("training-seconds"), message: "Training time per batch must be greater than zero." };
      }

      const troopLevel = upgradeMode ? Number(upgradeFrom.value) : Number(levelSelect.value);
      const destinationLevel = upgradeMode ? Number(upgradeTo.value) : troopLevel;
      const sourcePoints = pointsForLevel(troopLevel);
      const destinationPoints = pointsForLevel(destinationLevel);
      if (!Number.isInteger(troopLevel) || !Number.isInteger(destinationLevel) || (upgradeMode && destinationLevel <= troopLevel)) {
        const field = upgradeMode ? upgradeTo : levelSelect;
        throw { field, message: "The destination troop level must be higher than the starting level." };
      }

      const pointsPerTroop = upgradeMode ? destinationPoints - sourcePoints : destinationPoints;
      if (!Number.isSafeInteger(sourcePoints) || !Number.isSafeInteger(destinationPoints) ||
          !Number.isSafeInteger(pointsPerTroop) || pointsPerTroop < 0) {
        const field = upgradeMode ? upgradeTo : levelSelect;
        throw { field, message: "Points for the selected troop level could not be calculated." };
      }
      const completedBatches = Math.floor(speedupSeconds / trainingSeconds);
      const totalTroops = completedBatches * batchSize;
      const totalPoints = totalTroops * pointsPerTroop;
      const remainingSpeedups = speedupSeconds - completedBatches * trainingSeconds;

      if (![completedBatches, totalTroops, totalPoints, remainingSpeedups].every(Number.isSafeInteger)) {
        throw { field: document.getElementById("troops-per-batch"), message: "These values are too large to calculate safely. Reduce one or more values." };
      }

      document.getElementById("total-points").textContent = numberFormat.format(totalPoints);
      document.getElementById("result-level").textContent = `Level ${troopLevel}`;
      document.getElementById("result-to-level").textContent = `Level ${destinationLevel}`;
      document.getElementById("result-points-per-troop").textContent = `${numberFormat.format(pointsPerTroop)} points`;
      document.getElementById("result-batch-size").textContent = numberFormat.format(batchSize);
      document.getElementById("result-batches").textContent = numberFormat.format(completedBatches);
      document.getElementById("result-troops").textContent = numberFormat.format(totalTroops);
      document.getElementById("result-remaining").textContent = formatDuration(remainingSpeedups);
      results.hidden = false;
      placeholder.hidden = true;
    } catch (error) {
      if (!error || !error.field || !error.message) {
        throw error;
      }
      hideResults();
      setError(error.message, error.field);
    }
  });

  form.addEventListener("input", () => {
    clearError();
    hideResults();
  });

  form.addEventListener("change", () => {
    clearError();
    hideResults();
  });

  form.addEventListener("reset", () => {
    setMode(false);
    upgradeFrom.value = "1";
    updateUpgradeOptions();
    clearError();
    hideResults();
  });

  function formatDuration(totalSeconds) {
    const days = Math.floor(totalSeconds / secondsPerUnit[0]);
    const hours = Math.floor((totalSeconds % secondsPerUnit[0]) / secondsPerUnit[1]);
    const minutes = Math.floor((totalSeconds % secondsPerUnit[1]) / secondsPerUnit[2]);
    const seconds = totalSeconds % secondsPerUnit[2];
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
})();
