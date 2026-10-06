import * as React from "react";
import { GridProps, TextFieldProps } from "@aws-amplify/ui-react";
export declare type EscapeHatchProps = {
    [elementHierarchy: string]: Record<string, unknown>;
} | null;
export declare type VariantValues = {
    [key: string]: string;
};
export declare type Variant = {
    variantValues: VariantValues;
    overrides: EscapeHatchProps;
};
export declare type ValidationResponse = {
    hasError: boolean;
    errorMessage?: string;
};
export declare type ValidationFunction<T> = (value: T, validationResponse: ValidationResponse) => ValidationResponse | Promise<ValidationResponse>;
export declare type TodoCreateFormInputValues = {
    rawMemo?: string;
    content?: string;
    imageUrl?: string;
    aiComment?: string;
    createdAt?: string;
};
export declare type TodoCreateFormValidationValues = {
    rawMemo?: ValidationFunction<string>;
    content?: ValidationFunction<string>;
    imageUrl?: ValidationFunction<string>;
    aiComment?: ValidationFunction<string>;
    createdAt?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type TodoCreateFormOverridesProps = {
    TodoCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    rawMemo?: PrimitiveOverrideProps<TextFieldProps>;
    content?: PrimitiveOverrideProps<TextFieldProps>;
    imageUrl?: PrimitiveOverrideProps<TextFieldProps>;
    aiComment?: PrimitiveOverrideProps<TextFieldProps>;
    createdAt?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type TodoCreateFormProps = React.PropsWithChildren<{
    overrides?: TodoCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: TodoCreateFormInputValues) => TodoCreateFormInputValues;
    onSuccess?: (fields: TodoCreateFormInputValues) => void;
    onError?: (fields: TodoCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: TodoCreateFormInputValues) => TodoCreateFormInputValues;
    onValidate?: TodoCreateFormValidationValues;
} & React.CSSProperties>;
export default function TodoCreateForm(props: TodoCreateFormProps): React.ReactElement;
