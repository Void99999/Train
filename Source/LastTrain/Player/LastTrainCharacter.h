// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "LastTrainCharacter.generated.h"

class UCameraComponent;
class UHealthComponent;
class UStaminaComponent;
class UInteractionComponent;
class UInventoryComponent;
class UWeaponComponent;
class UWalletComponent;
class ULastTrainInputConfig;
class UInputAction;
struct FInputActionValue;

/**
 * The protagonist.
 *
 * An ACharacter rather than a bare APawn, and that choice is load-bearing.
 * Almost everything the player does happens on a train that is moving at up to
 * eighty kilometres an hour, and UCharacterMovementComponent already solves
 * standing on a moving thing: when the capsule's floor is a movable primitive
 * it becomes the character's base, and base movement is applied every frame, so
 * he rides the locomotive instead of being left behind by it. Rebuilding that
 * on a custom pawn would mean reimplementing one of the better-tested parts of
 * the engine.
 *
 * The character owns its faculties as components rather than as member
 * variables - health, stamina, what it is looking at, what it is carrying, what
 * it is holding - so each of them can be tested, replaced or put on something
 * else. The Loader gets health and an inventory; an enemy soldier gets health
 * and a weapon; neither needs a camera.
 */
UCLASS()
class LASTTRAIN_API ALastTrainCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ALastTrainCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

	UFUNCTION(BlueprintPure, Category = "Last Train") UCameraComponent* GetFirstPersonCamera() const { return FirstPersonCamera; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UHealthComponent* GetHealthComponent() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UStaminaComponent* GetStaminaComponent() const { return Stamina; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UInteractionComponent* GetInteractionComponent() const { return Interaction; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UInventoryComponent* GetInventoryComponent() const { return Inventory; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UWeaponComponent* GetWeaponComponent() const { return Weapon; }
	UFUNCTION(BlueprintPure, Category = "Last Train") UWalletComponent* GetWalletComponent() const { return Wallet; }

	/** True while the weapon wheel is held open. Movement continues; aiming does not. */
	UFUNCTION(BlueprintPure, Category = "Last Train")
	bool IsWeaponWheelOpen() const { return bWeaponWheelOpen; }

protected:
	/**
	 * Optional. Leave it unset and the character builds an equivalent binding
	 * set at runtime, so a freshly compiled project is playable immediately.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
	TObjectPtr<ULastTrainInputConfig> InputConfig;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input", meta = (ClampMin = "0.0"))
	float LookSensitivity = 0.6f;

	/** Eye height above the capsule's centre, in centimetres. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Camera")
	float EyeHeight = 68.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Camera")
	float CrouchedEyeHeight = 10.f;

	/* ------------------------------------------------------- components */

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UCameraComponent> FirstPersonCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UHealthComponent> Health;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UStaminaComponent> Stamina;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UInteractionComponent> Interaction;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UInventoryComponent> Inventory;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UWeaponComponent> Weapon;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<UWalletComponent> Wallet;

	/* ------------------------------------------------------- input handlers */

	void HandleMove(const FInputActionValue& Value);
	void HandleLook(const FInputActionValue& Value);
	void HandleSprintStarted(const FInputActionValue& Value);
	void HandleSprintCompleted(const FInputActionValue& Value);
	void HandleCrouchToggle(const FInputActionValue& Value);
	void HandleInteract(const FInputActionValue& Value);
	void HandleFireStarted(const FInputActionValue& Value);
	void HandleFireCompleted(const FInputActionValue& Value);
	void HandleReload(const FInputActionValue& Value);
	void HandleWheelOpened(const FInputActionValue& Value);
	void HandleWheelClosed(const FInputActionValue& Value);
	void HandlePause(const FInputActionValue& Value);

	UFUNCTION()
	void HandleDied();

	/** Puts whatever the inventory just equipped into the weapon component. */
	UFUNCTION()
	void HandleEquippedWeaponChanged(FName WeaponId);

private:
	/** Makes sure InputConfig exists and is complete, building a fallback if not. */
	void EnsureInputConfig();

	void ApplyEyeHeight();

	UPROPERTY(Transient) bool bWantsToSprint = false;
	UPROPERTY(Transient) bool bWeaponWheelOpen = false;
	UPROPERTY(Transient) FVector2D LastMoveInput = FVector2D::ZeroVector;
};
