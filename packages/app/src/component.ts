// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------

export type ComponentType = 'PUBLIC' | 'PRIVATE';

export type InstanceFactoryOptions = {
  instanceIdentifier?: string;
  options?: unknown;
};

export type ComponentFactory<T> = (
  container: ComponentContainer,
  options: InstanceFactoryOptions
) => T;

export type InstanceDisposer<T> = (instance: T) => void | Promise<void>;

export class Component<T = unknown> {
  multipleInstances = false;
  instantiationMode: 'LAZY' | 'EXPLICIT' = 'LAZY';

  constructor(
    readonly name: string,
    readonly instanceFactory: ComponentFactory<T>,
    readonly type: ComponentType = 'PUBLIC',
    readonly instanceDisposer?: InstanceDisposer<T>
  ) {}

  setMultipleInstances(value: boolean): this {
    this.multipleInstances = value;
    return this;
  }

  setInstantiationMode(mode: 'LAZY' | 'EXPLICIT'): this {
    this.instantiationMode = mode;
    return this;
  }
}

export class Provider<T = unknown> {
  private component: Component<T> | null = null;
  private instances = new Map<string, T>();
  private options = new Map<string, unknown>();
  private deleted = false;

  constructor(
    readonly name: string,
    private readonly container: ComponentContainer
  ) {}

  setComponent(component: Component<T>): void {
    this.component = component;
  }

  isInitialized(identifier: string = '[DEFAULT]'): boolean {
    return this.instances.has(identifier);
  }

  getInitializedInstances(): T[] {
    return Array.from(this.instances.values());
  }

  getOptions(identifier: string = '[DEFAULT]'): unknown {
    return this.options.get(identifier);
  }

  initialize(options: InstanceFactoryOptions = {}): T {
    this.assertNotDeleted();
    const identifier = options.instanceIdentifier ?? '[DEFAULT]';
    if (this.instances.has(identifier)) {
      return this.instances.get(identifier)!;
    }
    if (!this.component) {
      throw new Error(`Component ${this.name} has not been registered`);
    }
    const instance = this.component.instanceFactory(this.container, options);
    this.instances.set(identifier, instance);
    this.options.set(identifier, options.options ?? {});
    return instance;
  }

  getImmediate(options: { identifier?: string; optional?: boolean } = {}): T | null {
    this.assertNotDeleted();
    const identifier = options.identifier ?? '[DEFAULT]';
    if (this.instances.has(identifier)) {
      return this.instances.get(identifier)!;
    }
    if (!this.component) {
      if (options.optional) return null;
      throw new Error(`Component ${this.name} has not been registered`);
    }
    if (this.component.instantiationMode === 'EXPLICIT') {
      if (options.optional) return null;
      throw new Error(`Component ${this.name} must be initialized explicitly`);
    }
    return this.initialize({ instanceIdentifier: identifier });
  }

  async clearInstance(identifier: string = '[DEFAULT]'): Promise<void> {
    const instance = this.instances.get(identifier);
    if (instance !== undefined) {
      await this.component?.instanceDisposer?.(instance);
    }
    this.instances.delete(identifier);
    this.options.delete(identifier);
  }

  async clearInstances(): Promise<void> {
    let firstError: unknown;
    for (const identifier of [...this.instances.keys()]) {
      try {
        await this.clearInstance(identifier);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }

  async delete(): Promise<void> {
    if (this.deleted) return;
    await this.clearInstances();
    this.component = null;
    this.deleted = true;
  }

  private assertNotDeleted(): void {
    if (this.deleted) {
      throw new Error(`App for component ${this.name} has been deleted`);
    }
  }
}

export class ComponentContainer {
  private providers = new Map<string, Provider>();
  private deleted = false;

  constructor(readonly name: string) {}

  get isDeleted(): boolean {
    return this.deleted;
  }

  addComponent<T>(component: Component<T>): void {
    this.assertNotDeleted();
    const provider = this.getProvider<T>(component.name);
    provider.setComponent(component);
  }

  getProvider<T = unknown>(name: string): Provider<T> {
    this.assertNotDeleted();
    if (!this.providers.has(name)) {
      this.providers.set(name, new Provider(name, this));
    }
    return this.providers.get(name)! as Provider<T>;
  }

  async clearInstances(): Promise<void> {
    let firstError: unknown;
    for (const provider of [...this.providers.values()].reverse()) {
      try {
        await provider.clearInstances();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }

  async delete(): Promise<void> {
    if (this.deleted) return;
    let firstError: unknown;
    for (const provider of [...this.providers.values()].reverse()) {
      try {
        await provider.delete();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    this.providers.clear();
    this.deleted = true;
  }

  private assertNotDeleted(): void {
    if (this.deleted) {
      throw new Error(`App ${this.name} has been deleted`);
    }
  }
}
