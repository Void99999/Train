// Copyright LAST TRAIN. All rights reserved.

#include "Player/LastTrainCharacter.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Core/LastTrainGameInstance.h"
#include "Economy/WalletComponent.h"
#include "Data/LastTrainBalance.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "LastTrain.h"
#include "Player/HealthComponent.h"
#include "Player/InteractionComponent.h"
#include "Player/InventoryComponent.h"
#include "Player/LastTrainInputConfig.h"
#include "Player/StaminaComponent.h"
#include "Weapons/WeaponComponent.h"

ALastTrainCharacter::ALastTrainCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	// A person, not a barrel: narrow enough to fit through a cab door and tall
	// enough that the walkway railing comes to the waist.
	GetCapsuleComponent()->InitCapsuleSize(34.f, 90.f);

	FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
	FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
	FirstPersonCamera->SetRelativeLocation(FVector(0.f, 0.f, EyeHeight));
	FirstPersonCamera->bUsePawnControlRotation = true;

	// The mesh is for shadows and for the arms; the player never sees the body
	// from outside during normal play.
	if (USkeletalMeshComponent* BodyMesh = GetMesh())
	{
		BodyMesh->SetOwnerNoSee(true);
		BodyMesh->bCastHiddenShadow = true;
	}

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = false;
	Movement->bUseControllerDesiredRotation = false;
	Movement->GetNavAgentPropertiesRef().bCanCrouch = true;
	Movement->JumpZVelocity = 380.f;
	Movement->AirControl = 0.15f;
	Movement->BrakingDecelerationWalking = 2200.f;
	// Cab sills and the step out onto the walkway are a few centimetres. Any
	// lower and the doorway threshold stops him dead.
	Movement->MaxStepHeight = 32.f;
	Movement->SetWalkableFloorAngle(50.f);

	// Riding the train. Without these the character keeps his world velocity
	// when the locomotive accelerates underneath him and slides down the cab.
	Movement->bImpartBaseVelocityX = true;
	Movement->bImpartBaseVelocityY = true;
	Movement->bImpartBaseVelocityZ = false;
	Movement->bIgnoreBaseRotation = false;

	bUseControllerRotationYaw = true;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;

	Health = CreateDefaultSubobject<UHealthComponent>(TEXT("Health"));
	Stamina = CreateDefaultSubobject<UStaminaComponent>(TEXT("Stamina"));
	Interaction = CreateDefaultSubobject<UInteractionComponent>(TEXT("Interaction"));
	Inventory = CreateDefaultSubobject<UInventoryComponent>(TEXT("Inventory"));
	Weapon = CreateDefaultSubobject<UWeaponComponent>(TEXT("Weapon"));
	Wallet = CreateDefaultSubobject<UWalletComponent>(TEXT("Wallet"));
}

void ALastTrainCharacter::BeginPlay()
{
	Super::BeginPlay();

	const ULastTrainBalance& Balance = ULastTrainBalance::Get();
	GetCharacterMovement()->MaxWalkSpeed = Balance.Movement.WalkSpeed;
	GetCharacterMovement()->MaxWalkSpeedCrouched = Balance.Movement.CrouchSpeed;

	ApplyEyeHeight();

	if (Health)
	{
		Health->OnDied.AddDynamic(this, &ALastTrainCharacter::HandleDied);
	}

	/*
	 * The inventory decides what he is holding; the weapon component makes it
	 * fire. Connecting them here rather than having either call the other keeps
	 * both usable on an actor that has only one of them - an enemy has a weapon
	 * and no inventory, and the Loader will have the reverse.
	 */
	if (Inventory)
	{
		Inventory->OnEquippedWeaponChanged.AddDynamic(
			this, &ALastTrainCharacter::HandleEquippedWeaponChanged);

		// The inventory has already run its BeginPlay and picked up the pistol,
		// so the first change was broadcast before anything was listening.
		if (Weapon && !Inventory->GetEquippedWeapon().IsNone())
		{
			Weapon->Equip(Inventory->GetEquippedWeapon());
		}
	}
}

void ALastTrainCharacter::HandleEquippedWeaponChanged(FName WeaponId)
{
	if (Weapon)
	{
		Weapon->Equip(WeaponId);
	}
}

void ALastTrainCharacter::EnsureInputConfig()
{
	if (!InputConfig)
	{
		InputConfig = NewObject<ULastTrainInputConfig>(this, TEXT("RuntimeInputConfig"));
	}
	InputConfig->BuildRuntimeFallback(this);
}

void ALastTrainCharacter::PawnClientRestart()
{
	Super::PawnClientRestart();

	EnsureInputConfig();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Subsystem->ClearAllMappings();
			Subsystem->AddMappingContext(InputConfig->MappingContext, /*Priority*/ 0);
		}
	}
}

void ALastTrainCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	EnsureInputConfig();

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		UE_LOG(LogLastTrainPlayer, Error,
			TEXT("Input component is not an EnhancedInputComponent. Check DefaultInputComponentClass ")
			TEXT("in DefaultInput.ini - nothing will respond to the keyboard until it is."));
		return;
	}

	Input->BindAction(InputConfig->Move, ETriggerEvent::Triggered, this, &ALastTrainCharacter::HandleMove);
	Input->BindAction(InputConfig->Move, ETriggerEvent::Completed, this, &ALastTrainCharacter::HandleMove);
	Input->BindAction(InputConfig->Look, ETriggerEvent::Triggered, this, &ALastTrainCharacter::HandleLook);

	Input->BindAction(InputConfig->Jump, ETriggerEvent::Started, this, &ACharacter::Jump);
	Input->BindAction(InputConfig->Jump, ETriggerEvent::Completed, this, &ACharacter::StopJumping);

	Input->BindAction(InputConfig->Sprint, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleSprintStarted);
	Input->BindAction(InputConfig->Sprint, ETriggerEvent::Completed, this, &ALastTrainCharacter::HandleSprintCompleted);

	Input->BindAction(InputConfig->Crouch, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleCrouchToggle);
	Input->BindAction(InputConfig->Interact, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleInteract);

	Input->BindAction(InputConfig->Fire, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleFireStarted);
	Input->BindAction(InputConfig->Fire, ETriggerEvent::Completed, this, &ALastTrainCharacter::HandleFireCompleted);
	Input->BindAction(InputConfig->Reload, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleReload);

	// Held, not toggled. The wheel is up for as long as TAB is down.
	Input->BindAction(InputConfig->WeaponWheel, ETriggerEvent::Started, this, &ALastTrainCharacter::HandleWheelOpened);
	Input->BindAction(InputConfig->WeaponWheel, ETriggerEvent::Completed, this, &ALastTrainCharacter::HandleWheelClosed);

	Input->BindAction(InputConfig->Pause, ETriggerEvent::Started, this, &ALastTrainCharacter::HandlePause);
}

void ALastTrainCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	const bool bMoving = !LastMoveInput.IsNearlyZero();
	const bool bSprinting = Stamina ? Stamina->Update(DeltaSeconds, bWantsToSprint, bMoving) : false;

	const ULastTrainBalance& Balance = ULastTrainBalance::Get();
	GetCharacterMovement()->MaxWalkSpeed = bSprinting
		? Balance.Movement.SprintSpeed
		: Balance.Movement.WalkSpeed;

	// Input is consumed here rather than latched, so releasing the keys stops
	// him even on a frame where no input event arrived.
	LastMoveInput = FVector2D::ZeroVector;
}

void ALastTrainCharacter::ApplyEyeHeight()
{
	if (FirstPersonCamera)
	{
		const float Height = bIsCrouched ? CrouchedEyeHeight : EyeHeight;
		FirstPersonCamera->SetRelativeLocation(FVector(0.f, 0.f, Height));
	}
}

/* ----------------------------------------------------------------- input */

void ALastTrainCharacter::HandleMove(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	LastMoveInput = Axis;

	if (Axis.IsNearlyZero() || !Controller)
	{
		return;
	}

	// Movement is relative to where the player is looking, flattened - looking
	// at the floor must not walk him into it.
	const FRotator YawOnly(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::Y);

	AddMovementInput(Forward, Axis.Y);
	AddMovementInput(Right, Axis.X);
}

void ALastTrainCharacter::HandleLook(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();

	AddControllerYawInput(Axis.X * LookSensitivity);
	// Negated once, here. Mouse Y grows downward; a camera pitch grows upward.
	AddControllerPitchInput(-Axis.Y * LookSensitivity);
}

void ALastTrainCharacter::HandleSprintStarted(const FInputActionValue&)
{
	bWantsToSprint = true;
}

void ALastTrainCharacter::HandleSprintCompleted(const FInputActionValue&)
{
	bWantsToSprint = false;
}

void ALastTrainCharacter::HandleCrouchToggle(const FInputActionValue&)
{
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
	ApplyEyeHeight();
}

void ALastTrainCharacter::HandleInteract(const FInputActionValue&)
{
	if (Interaction)
	{
		Interaction->Activate();
	}
}

void ALastTrainCharacter::HandleFireStarted(const FInputActionValue&)
{
	// The wheel takes the mouse while it is open, so firing is refused rather
	// than queued - a shot fired on wheel-close would come out of nowhere.
	if (Weapon && !bWeaponWheelOpen)
	{
		Weapon->StartFiring();
	}
}

void ALastTrainCharacter::HandleFireCompleted(const FInputActionValue&)
{
	if (Weapon)
	{
		Weapon->StopFiring();
	}
}

void ALastTrainCharacter::HandleReload(const FInputActionValue&)
{
	if (Weapon)
	{
		Weapon->BeginReload();
	}
}

void ALastTrainCharacter::HandleWheelOpened(const FInputActionValue&)
{
	bWeaponWheelOpen = true;
	if (Weapon)
	{
		Weapon->StopFiring();
	}
}

void ALastTrainCharacter::HandleWheelClosed(const FInputActionValue&)
{
	bWeaponWheelOpen = false;
}

void ALastTrainCharacter::HandlePause(const FInputActionValue&)
{
	if (ULastTrainGameInstance* GameInstance = ULastTrainGameInstance::Get(this))
	{
		const ELastTrainState State = GameInstance->GetState();
		GameInstance->RequestState(State == ELastTrainState::Paused
			? ELastTrainState::Playing
			: ELastTrainState::Paused);
	}
}

void ALastTrainCharacter::HandleDied()
{
	UE_LOG(LogLastTrainPlayer, Log, TEXT("The protagonist is down."));

	if (Interaction)
	{
		Interaction->ClearFocus();
	}
	if (Weapon)
	{
		Weapon->StopFiring();
	}

	// The run manager decides what happens next - Normal sends him back to the
	// last outpost, Hardcore ends the run - so the character only reports it.
	if (ULastTrainGameInstance* GameInstance = ULastTrainGameInstance::Get(this))
	{
		GameInstance->RequestState(ELastTrainState::RunFailed);
	}
}
