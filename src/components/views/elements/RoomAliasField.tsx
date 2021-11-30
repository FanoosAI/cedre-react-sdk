/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef, KeyboardEventHandler } from "react";

import { _t } from '../../../languageHandler';
import withValidation from './Validation';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import Field, { IValidateOpts } from "./Field";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    domain?: string;
    value: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    onKeyDown?: KeyboardEventHandler;
    onChange?(value: string): void;
}

interface IState {
    isValid: boolean;
}

// Controlled form component wrapping Field for inputting a room alias scoped to a given domain
@replaceableComponent("views.elements.RoomAliasField")
export default class RoomAliasField extends React.PureComponent<IProps, IState> {
    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    private fieldRef = createRef<Field>();

    constructor(props, context) {
        super(props, context);

        this.state = {
            isValid: true,
        };
    }

    private asFullAlias(localpart: string): string {
        const hashAlias = `#${ localpart }`;
        if (this.props.domain) {
            return `${hashAlias}:${this.props.domain}`;
        }
        return hashAlias;
    }

    private get domainProps() {
        const { domain } = this.props;
        const prefix = <span>#</span>;
        const postfix = domain ? (<span title={`:${domain}`}>{ `:${domain}` }</span>) : <span />;
        const maxlength = domain ? 255 - domain.length - 2 : 255 - 1;   // 2 for # and :
        const value = domain ?
            this.props.value.substring(1, this.props.value.length - this.props.domain.length - 1) :
            this.props.value.substring(1);

        return { prefix, postfix, value, maxlength };
    }

    render() {
        const { prefix, postfix, value, maxlength } = this.domainProps;
        return (
            <Field
                label={this.props.label || _t("Room address")}
                className="mx_RoomAliasField"
                prefixComponent={prefix}
                postfixComponent={postfix}
                ref={this.fieldRef}
                onValidate={this.onValidate}
                placeholder={this.props.placeholder || _t("e.g. my-room")}
                onChange={this.onChange}
                value={value}
                maxLength={maxlength}
                disabled={this.props.disabled}
                autoComplete="off"
                onKeyDown={this.props.onKeyDown}
            />
        );
    }

    private onChange = (ev) => {
        if (this.props.onChange) {
            this.props.onChange(this.asFullAlias(ev.target.value));
        }
    };

    private onValidate = async (fieldState) => {
        const result = await this.validationRules(fieldState);
        this.setState({ isValid: result.valid });
        return result;
    };

    private validationRules = withValidation({
        rules: [
            { key: "hasSingleDomain",
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    // Ignore if we have passed domain
                    if (this.props.domain) {
                        return true;
                    }
                    const split = value.split(':');
                    if (split.length < 2) {
                        return false;
                    }
                    return true;
                },
                invalid: () => _t("Missing domain separator e.g. (:domain.org)"),
            },
            {
                key: "hasMultipleDomains",
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    // Ignore if we have passed domain
                    if (this.props.domain) {
                        return true;
                    }
                    const split = value.split(':');
                    if (split.length > 2) {
                        return false;
                    }
                    return true;
                },
                invalid: () => _t("Multiple domain separators (:) provided, provide an alias with a single domain."),
            },
            {
                key: "safeLocalpart",
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    if (!this.props.domain) {
                        return true;
                    } else {
                        const fullAlias = this.asFullAlias(value);
                        // XXX: FIXME https://github.com/matrix-org/matrix-doc/issues/668
                        return !value.includes("#") &&
                        this.props.domain ? !value.includes(":") : true &&
                        !value.includes(",") &&
                            encodeURI(fullAlias) === fullAlias;
                    }
                },
                invalid: () => _t("Some characters not allowed"),
            }, {
                key: "required",
                test: async ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Please provide an address"),
            }, {
                key: "taken",
                final: true,
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    const client = this.context;
                    try {
                        await client.getRoomIdForAlias(this.asFullAlias(value));
                        // we got a room id, so the alias is taken
                        return false;
                    } catch (err) {
                        console.log(err);
                        // any server error code will do,
                        // either it M_NOT_FOUND or the alias is invalid somehow,
                        // in which case we don't want to show the invalid message
                        return !!err.errcode;
                    }
                },
                valid: () => _t("This address is available to use"),
                invalid: () => this.props.domain ?
                    _t("This address is already in use") :
                    _t("This address had invalid server or is already in use"),
            },
        ],
    });

    public get isValid() {
        return this.state.isValid;
    }

    public validate(options: IValidateOpts) {
        return this.fieldRef.current?.validate(options);
    }

    public focus() {
        this.fieldRef.current?.focus();
    }
}
